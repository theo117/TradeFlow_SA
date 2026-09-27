import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../lib/db/schema";

const state = vi.hoisted(() => {
  vi.stubEnv("AUTH_SECRET", "h01-synthetic-auth-secret-for-disposable-tests-only");
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  return { db: undefined as unknown as PostgresJsDatabase<typeof schema>, cookie: "" };
});
// Only the database destination and Next.js request-header boundary are replaced.
// Real Auth.js handlers, CSRF, credentials, bcrypt, encrypted cookies, callbacks,
// server auth guards and protected route handlers execute below.
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: state.cookie, host: "localhost:3000", "x-forwarded-proto": "http", "x-forwarded-for": "192.0.2.10" }),
  cookies: async () => ({ getAll: () => [], set: vi.fn(), delete: vi.fn() })
}));

import { handlers, auth } from "../auth";
import { requireUser } from "../lib/auth";
import * as passwords from "../lib/password";
import { createEmailVerificationToken, verifyEmailToken } from "../lib/email-verification";
import { createPasswordResetToken, resetPasswordWithToken } from "../lib/password-reset";
import { GET as invoicePdf } from "../app/api/invoices/[id]/pdf/route";
import { GET as quotePdf } from "../app/api/quotes/[id]/pdf/route";
import { register, requestPasswordReset, resendEmailVerification, confirmEmail, resetPassword, login as loginAction } from "../app/(auth)/actions";
import RegisterPage from "../app/(auth)/register/page";
import LoginPage from "../app/(auth)/login/page";
import VerifyPage from "../app/(auth)/verify-email/page";
import ForgotPage from "../app/(auth)/forgot-password/page";
import ResetPage from "../app/(auth)/reset-password/page";
import { loginErrorMessage } from "../lib/auth-messages";
import { sendPasswordResetEmail } from "../lib/password-reset";
import { sendEmailVerification } from "../lib/email-verification";

const execute = promisify(execFile);
const adminUrl = process.env.ACCOUNT_TEST_ADMIN_URL;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const oldPassword = "SyntheticOldPassword!123";
const newPassword = "SyntheticNewPassword!456";
const cookieName = "authjs.session-token";
const baseUrl = "http://localhost:3000";

describe.skipIf(!adminUrl)("account access H01/H02 (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  let pool: Pool;
  let client: ReturnType<typeof postgres>;
  let fixture: string;
  let name: string;
  let originalHash: string;

  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h01_test_admin") throw new Error("Use only disposable localhost PostgreSQL with database h01_test_admin.");
    admin = new Pool({ connectionString: url.href });
    const version = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    expect(version).toBeGreaterThanOrEqual(170000); expect(version).toBeLessThan(180000);
    fixture = `h01_fixture_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${fixture}"`); url.pathname = `/${fixture}`;
    await execute("npm", ["run", "db:migrate"], { env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href }, timeout: 30000 });
    originalHash = await passwords.hashPassword(oldPassword);
  }, 30000);
  beforeEach(async () => {
    name = `h01_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${fixture}"`);
    const url = new URL(adminUrl!); url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.href });
    await pool.query("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES ($1,'one@example.test',$3,now()),($2,'two@example.test',$3,now())", [id(1),id(2),originalHash]);
    await pool.query("INSERT INTO businesses(id,owner_id,name,subscription_status,current_period_end) VALUES ($1,$2,'One','active','2099-01-01'),($3,$4,'Two','active','2099-01-01')", [id(3),id(1),id(4),id(2)]);
    client = postgres(url.href, { prepare: false, max: 4, connection: { application_name: "h01_auth_test" } });
    state.db = drizzle(client, { schema }); state.cookie = "";
    vi.stubEnv("EMAIL_ENABLED", "true"); vi.stubEnv("RESEND_API_KEY", "synthetic"); vi.stubEnv("EMAIL_FROM", "noreply@example.test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await pool.query("INSERT INTO customers(id,business_id,name) VALUES ($1,$2,'Synthetic customer')", [id(5),id(3)]);
    await pool.query("INSERT INTO invoices(id,business_id,customer_id,total,due_date) VALUES ($1,$2,$3,123.45,'2099-01-01')", [id(6),id(3),id(5)]);
    await pool.query("INSERT INTO quotes(id,business_id,customer_id,status,total) VALUES ($1,$2,$3,'draft',123.45)", [id(7),id(3),id(5)]);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.stubEnv("BILLING_ENFORCEMENT", "off");
    if (client) await client.end(); if (pool) await pool.end();
    if (name) {
      await vi.waitFor(async () => expect((await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1", [name])).rows[0].count).toBe(0), { timeout: 5000, interval: 20 });
      await admin.query(`DROP DATABASE "${name}"`);
    }
  });
  afterAll(async () => {
    if (fixture) await admin.query(`DROP DATABASE "${fixture}"`);
    if (admin) await admin.end(); vi.unstubAllEnvs();
  });

  function mergeCookies(jar: Map<string, string>, response: Response) {
    for (const entry of response.headers.getSetCookie()) {
      const pair = entry.split(";", 1)[0]; const split = pair.indexOf("=");
      const key = pair.slice(0, split), value = pair.slice(split+1);
      if (!value || /Max-Age=0/i.test(entry)) jar.delete(key); else jar.set(key, value);
    }
  }
  function cookieHeader(jar: Map<string, string>) { return [...jar].map(([key,value]) => `${key}=${value}`).join("; "); }
  async function csrf(jar: Map<string, string>) {
    const response = await handlers.GET(new NextRequest(`${baseUrl}/api/auth/csrf`, { headers: { cookie: cookieHeader(jar) } }));
    expect(response.status).toBe(200); mergeCookies(jar,response);
    return (await response.json()).csrfToken as string;
  }
  async function login(password = oldPassword, email = "one@example.test", ip = "192.0.2.10", ui = false) {
    const jar = new Map<string, string>(); const csrfToken = await csrf(jar);
    const response = await handlers.POST(new NextRequest(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(jar), "x-forwarded-for": ip, ...(ui ? { "X-Auth-Return-Redirect": "1" } : {}) },
      body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${baseUrl}/dashboard` }).toString()
    }));
    mergeCookies(jar,response);
    return { jar, cookie: cookieHeader(jar), response };
  }
  async function session(cookie: string) {
    const response = await handlers.GET(new NextRequest(`${baseUrl}/api/auth/session`, { headers: { cookie } }));
    expect(response.status).toBe(200); return response.json();
  }
  async function data() {
    return { users: (await pool.query("SELECT to_jsonb(u) AS row FROM users u ORDER BY id")).rows,
      tokens: (await pool.query("SELECT to_jsonb(t) AS row FROM password_reset_tokens t ORDER BY id")).rows,
      verification: (await pool.query("SELECT to_jsonb(t) AS row FROM email_verification_tokens t ORDER BY id")).rows };
  }
  async function account(userId = id(1)) { return (await pool.query("SELECT * FROM users WHERE id=$1", [userId])).rows[0]; }
  function form(values: Record<string,string>) { const data = new FormData(); for (const [key,value] of Object.entries(values)) data.set(key,value); return data; }
  async function destination(action: () => unknown) {
    try { await action(); throw new Error("Expected a redirect"); }
    catch (error) { expect(error).toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") }); return (error as { digest: string }).digest.split(";")[2]; }
  }
  function code(response: Response) { return new URL(response.headers.get("location")!, baseUrl).searchParams.get("code"); }

  it("keeps the registration page and direct action disabled without creating users", async () => {
    const before = await data();
    expect(await destination(() => RegisterPage())).toBe("/login");
    expect(await destination(() => register(form({ email: "new@example.test", password: newPassword, businessName: "New" })))).toBe("/login");
    expect(await data()).toEqual(before); expect(fetch).not.toHaveBeenCalled();
  });
  it("verifies only the token's user once, including concurrent submissions", async () => {
    await pool.query("UPDATE users SET email_verified_at=null");
    const token = await createEmailVerificationToken(id(1)); const other = await account(id(2));
    const results = await Promise.all([verifyEmailToken(token.token), verifyEmailToken(token.token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await account()).email_verified_at).not.toBeNull(); expect(await account(id(2))).toEqual(other);
    const stored = await account(); expect((await verifyEmailToken(token.token)).ok).toBe(false); expect(await account()).toEqual(stored);
    expect(await session((await login()).cookie)).toMatchObject({ user: { id: id(1) } });
  });
  it.each(["invalid","expired","used"])("rejects %s verification tokens without modifying either user", async (kind) => {
    await pool.query("UPDATE users SET email_verified_at=null"); const token = await createEmailVerificationToken(id(1));
    if (kind === "expired") await pool.query("UPDATE email_verification_tokens SET expires_at=now()-interval '1 second'");
    if (kind === "used") await pool.query("UPDATE email_verification_tokens SET used_at=now()");
    const before = await data();
    expect((await verifyEmailToken(kind === "invalid" ? "x".repeat(43) : token.token)).ok).toBe(false);
    expect(await data()).toEqual(before);
  });
  it("rolls back the verification claim when updating the user fails", async () => {
    await pool.query("UPDATE users SET email_verified_at=null WHERE id=$1", [id(1)]);
    const token = await createEmailVerificationToken(id(1));
    await pool.query("CREATE FUNCTION h01_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$; CREATE TRIGGER h01_fail AFTER UPDATE ON users FOR EACH ROW EXECUTE FUNCTION h01_fail()");
    await expect(verifyEmailToken(token.token)).rejects.toThrow();
    expect((await pool.query("SELECT used_at FROM email_verification_tokens")).rows[0].used_at).toBeNull();
    expect((await account()).email_verified_at).toBeNull();
  });
  it("consumes verification via the page action, never by rendering its GET page", async () => {
    await pool.query("UPDATE users SET email_verified_at=null WHERE id=$1", [id(1)]);
    const token = await createEmailVerificationToken(id(1));
    const html = renderToStaticMarkup(await VerifyPage({ searchParams: Promise.resolve({ token: token.token }) }));
    expect(html).toContain("Verify email"); expect((await account()).email_verified_at).toBeNull();
    expect(await destination(() => confirmEmail(form({ token: token.token, userId: id(2) })))).toBe("/login?success=email_verified");
    expect(await destination(() => confirmEmail(form({ token: token.token })))).toBe("/verify-email?code=invalid_token");
  });
  it("gives identical forgot-password responses for known, unknown and provider-failure requests without changing passwords", async () => {
    const before = await account();
    const existing = await destination(() => requestPasswordReset(form({ email: "one@example.test" })));
    const missing = await destination(() => requestPasswordReset(form({ email: "missing@example.test" })));
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Private provider/database detail"));
    const failure = await destination(() => requestPasswordReset(form({ email: "one@example.test" })));
    expect([existing,missing,failure]).toEqual(Array(3).fill("/forgot-password?sent=1"));
    expect(await account()).toEqual(before);
    expect((await pool.query("SELECT count(*)::int AS n FROM password_reset_tokens")).rows[0].n).toBe(2);
  });
  it("limits reset requests without revealing account existence", async () => {
    for (let i=0;i<7;i++) expect(await destination(() => requestPasswordReset(form({ email: "one@example.test" })))).toBe("/forgot-password?sent=1");
    expect(fetch).toHaveBeenCalledTimes(5);
    expect((await pool.query("SELECT count(*)::int AS n FROM password_reset_tokens")).rows[0].n).toBe(5);
  });
  it("keeps verification-resend responses private for unverified, verified and unknown accounts and email failures", async () => {
    await pool.query("UPDATE users SET email_verified_at=null WHERE id=$1", [id(1)]);
    vi.mocked(fetch).mockRejectedValue(new Error("Private mail provider error"));
    for (const email of ["one@example.test","two@example.test","missing@example.test"]) expect(await destination(() => resendEmailVerification(form({ email })))).toBe("/verify-email?sent=1");
    expect((await account()).email_verified_at).toBeNull();
  });
  it("honors disabled email configuration even if provider credentials exist", async () => {
    vi.stubEnv("EMAIL_ENABLED","false");
    await sendPasswordResetEmail({ email: "one@example.test", resetUrl: "https://example.test/reset" });
    await sendEmailVerification({ email: "one@example.test", verificationUrl: "https://example.test/verify" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves configured email delivery when the optional email flag is unset", async () => {
    vi.stubEnv("EMAIL_ENABLED", undefined);
    await sendPasswordResetEmail({ email: "one@example.test", resetUrl: "https://example.test/reset" });
    await sendEmailVerification({ email: "one@example.test", verificationUrl: "https://example.test/verify" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("serializes recovery requests and fails closed if their limiter is unavailable", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => destination(() => requestPasswordReset(form({ email: "one@example.test" })))));
    expect(results).toEqual(Array(8).fill("/forgot-password?sent=1")); expect(fetch).toHaveBeenCalledTimes(5);
    await pool.query("ALTER TABLE rate_limits RENAME TO unavailable_rate_limits");
    expect(await destination(() => requestPasswordReset(form({ email: "two@example.test" })))).toBe("/forgot-password?sent=1");
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("resets through the action, revokes the old session, rejects reuse, and leaves the other user untouched", async () => {
    const old = await login(); const token = await createPasswordResetToken(id(1)); const other = await account(id(2));
    expect(await destination(() => resetPassword(form({ token: token.token, password: newPassword, userId: id(2) })))).toBe("/login?success=password_reset");
    expect(await session(old.cookie)).toBeNull(); expect(await account(id(2))).toEqual(other);
    expect((await account()).session_version).toBe(1);
    expect(await destination(() => resetPassword(form({ token: token.token, password: oldPassword })))).toBe("/reset-password?code=invalid_token");
    expect(await session((await login(newPassword)).cookie)).toMatchObject({ user: { id: id(1) } });
  });
  it("does not turn password recovery into email verification", async () => {
    await pool.query("UPDATE users SET email_verified_at=null WHERE id=$1", [id(1)]);
    const token = await createPasswordResetToken(id(1));
    expect((await resetPasswordWithToken({ token: token.token, password: newPassword })).ok).toBe(true);
    expect((await account()).email_verified_at).toBeNull();
    expect(code((await login(newPassword)).response)).toBe("email_not_verified");
  });
  it("throttles the normal UI callback and direct callback, including a correct password and changed IP", async () => {
    for (let i=0;i<5;i++) {
      const result = await login("WrongPassword!", "one@example.test", `192.0.2.${i}`, true);
      expect(new URL((await result.response.json()).url).searchParams.get("code")).toBe("credentials");
      expect(await session(result.cookie)).toBeNull();
    }
    expect(code((await login(oldPassword, "ONE@example.test", "198.51.100.20")).response)).toBe("too_many_attempts");
    expect(code((await login("WrongPassword!")).response)).toBe("too_many_attempts");
    const result = await destination(() => loginAction(form({ email: "one@example.test", password: oldPassword })));
    expect(result).toBe("/login?code=too_many_attempts");
    expect((await pool.query("SELECT attempt_count FROM login_rate_limits")).rows).toEqual([{ attempt_count: 5 }]);
    await pool.query("UPDATE login_rate_limits SET blocked_until=now()-interval '1 second',window_started_at=now()-interval '16 minutes'");
    expect(await session((await login()).cookie)).toMatchObject({ user: { id: id(1) } });
    expect((await pool.query("SELECT count(*)::int AS n FROM login_rate_limits")).rows[0].n).toBe(0);
  });
  it("serializes concurrent callback failures without losing attempts", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => login("WrongPassword!")));
    expect(results.filter((r) => code(r.response) === "credentials")).toHaveLength(5);
    expect(results.filter((r) => code(r.response) === "too_many_attempts")).toHaveLength(3);
    expect((await pool.query("SELECT attempt_count FROM login_rate_limits")).rows).toEqual([{ attempt_count: 5 }]);
  });
  it("counts malformed requests and fails closed when limiter persistence is unavailable", async () => {
    for (let i=0;i<5;i++) expect(code((await login("", "invalid-email")).response)).toBe("credentials");
    expect(code((await login("", "another invalid")).response)).toBe("too_many_attempts");
    await pool.query("ALTER TABLE login_rate_limits RENAME TO unavailable_login_limits");
    const result = await login(); expect(await session(result.cookie)).toBeNull();
    expect(result.response.headers.get("location")).not.toContain("unavailable_login_limits");
  });
  it("rejects unverified credentials and legacy sessions consistently at auth and both PDF routes", async () => {
    const old = await login(); state.cookie = old.cookie;
    expect((await invoicePdf(new Request(`${baseUrl}/api/invoices/${id(6)}/pdf`), { params: Promise.resolve({id:id(6)}) })).status).toBe(200);
    expect((await quotePdf(new Request(`${baseUrl}/api/quotes/${id(7)}/pdf`), { params: Promise.resolve({id:id(7)}) })).status).toBe(200);
    await pool.query("UPDATE users SET email_verified_at=null WHERE id=$1", [id(1)]);
    expect(await auth()).toBeNull(); expect(await session(old.cookie)).toBeNull();
    expect((await invoicePdf(new Request(`${baseUrl}/api/invoices/${id(6)}/pdf`), { params: Promise.resolve({id:id(6)}) })).status).toBe(404);
    expect((await quotePdf(new Request(`${baseUrl}/api/quotes/${id(7)}/pdf`), { params: Promise.resolve({id:id(7)}) })).status).toBe(404);
    const result=await login(); expect(code(result.response)).toBe("email_not_verified"); expect(result.jar.has(cookieName)).toBe(false);
    expect(code((await login("WrongPassword!")).response)).toBe("credentials");
    const other=await login(oldPassword,"two@example.test"); state.cookie=other.cookie; expect((await requireUser()).id).toBe(id(2));
  });
  it("preserves signout, expiry and legacy verified-session version behavior", async () => {
    const current=await login(); const csrfToken=await csrf(current.jar);
    const response=await handlers.POST(new NextRequest(`${baseUrl}/api/auth/signout`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:cookieHeader(current.jar)},body:new URLSearchParams({csrfToken}).toString()}));
    mergeCookies(current.jar,response); expect(current.jar.has(cookieName)).toBe(false); expect(await session(cookieHeader(current.jar))).toBeNull();
    const expired=await encode({secret:process.env.AUTH_SECRET!,salt:cookieName,maxAge:-60,token:{sub:id(1),sessionVersion:0}});
    expect(await session(`${cookieName}=${expired}`)).toBeNull();
    const legacy=await encode({secret:process.env.AUTH_SECRET!,salt:cookieName,token:{sub:id(1)}});
    expect(await session(`${cookieName}=${legacy}`)).toMatchObject({user:{id:id(1)}});
    const token=await createPasswordResetToken(id(1));await resetPasswordWithToken({token:token.token,password:newPassword});
    expect(await session(`${cookieName}=${legacy}`)).toBeNull();
  });
  it("renders safe recovery/login messages and reachable forms without reflecting internal errors", async () => {
    const secret="PRIVATE_DATABASE_ERROR";
    const loginHtml=renderToStaticMarkup(await LoginPage({searchParams:Promise.resolve({error:secret,success:secret})}));
    expect(loginHtml).not.toContain(secret);expect(loginHtml).toContain("Unable to log in");expect(loginHtml).toContain("/forgot-password");
    for(const value of ["credentials","too_many_attempts","email_not_verified"]) {
      const html=renderToStaticMarkup(await LoginPage({searchParams:Promise.resolve({code:value})}));expect(html).toContain(loginErrorMessage(value));
    }
    expect(renderToStaticMarkup(await LoginPage({searchParams:Promise.resolve({success:"email_verified"})}))).toContain("Email verified");
    expect(renderToStaticMarkup(await LoginPage({searchParams:Promise.resolve({success:"password_reset"})}))).toContain("Password updated");
    const forgot=renderToStaticMarkup(await ForgotPage({searchParams:Promise.resolve({sent:"1",code:secret})}));expect(forgot).toContain("If an account matches");expect(forgot).not.toContain(secret);
    const reset=renderToStaticMarkup(await ResetPage({searchParams:Promise.resolve({token:"x".repeat(43)})}));expect(reset).toContain('name="password"');
    const invalid=renderToStaticMarkup(await ResetPage({searchParams:Promise.resolve({})}));expect(invalid).toContain("invalid, expired, or already used");expect(invalid).not.toContain('name="password"');
  });
});
