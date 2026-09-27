import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { NextRequest } from "next/server";
import { decode, encode } from "next-auth/jwt";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../lib/db/schema";

const state = vi.hoisted(() => {
  vi.stubEnv("AUTH_SECRET", "h14-synthetic-auth-secret-for-disposable-tests-only");
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  return { db: undefined as unknown as PostgresJsDatabase<typeof schema>, cookie: "" };
});
// Only the database destination and Next.js request-header boundary are replaced.
// Real Auth.js handlers, CSRF, credentials, bcrypt, encrypted cookies, callbacks,
// server auth guards and protected route handlers execute below.
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: state.cookie, host: "localhost:3000", "x-forwarded-proto": "http" }) }));

import { handlers, auth } from "../auth";
import { requireUser, requirePaidBusiness } from "../lib/auth";
import * as passwords from "../lib/password";
import { createEmailVerificationToken, verifyEmailToken } from "../lib/email-verification";
import { createPasswordResetToken, resetPasswordWithToken } from "../lib/password-reset";
import DashboardLayout from "../app/dashboard/layout";
import { GET as checkout } from "../app/api/payfast/checkout/route";
import { GET as invoiceExport } from "../app/api/export/invoices/route";

const execute = promisify(execFile);
const adminUrl = process.env.RESET_TEST_ADMIN_URL;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const oldPassword = "SyntheticOldPassword!123";
const newPassword = "SyntheticNewPassword!456";
const cookieName = "authjs.session-token";
const baseUrl = "http://localhost:3000";

describe.skipIf(!adminUrl)("password reset and session revocation (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  let pool: Pool;
  let client: ReturnType<typeof postgres>;
  let fixture: string;
  let name: string;
  let originalHash: string;

  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h14_test_admin") throw new Error("Use only disposable localhost PostgreSQL with database h14_test_admin.");
    admin = new Pool({ connectionString: url.href });
    const version = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    expect(version).toBeGreaterThanOrEqual(170000); expect(version).toBeLessThan(180000);
    fixture = `h14_fixture_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${fixture}"`); url.pathname = `/${fixture}`;
    await execute("npm", ["run", "db:migrate"], { env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href }, timeout: 30000 });
    originalHash = await passwords.hashPassword(oldPassword);
  }, 30000);
  beforeEach(async () => {
    name = `h14_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${fixture}"`);
    const url = new URL(adminUrl!); url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.href });
    await pool.query("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES ($1,'one@example.test',$3,now()),($2,'two@example.test',$3,now())", [id(1),id(2),originalHash]);
    await pool.query("INSERT INTO businesses(id,owner_id,name,subscription_status,current_period_end) VALUES ($1,$2,'One','active','2099-01-01'),($3,$4,'Two','active','2099-01-01')", [id(3),id(1),id(4),id(2)]);
    client = postgres(url.href, { prepare: false, max: 4, connection: { application_name: "h14_auth_test" } });
    state.db = drizzle(client, { schema }); state.cookie = "";
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
  async function login(password = oldPassword, email = "one@example.test") {
    const jar = new Map<string, string>(); const csrfToken = await csrf(jar);
    const response = await handlers.POST(new NextRequest(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(jar) },
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
      tokens: (await pool.query("SELECT to_jsonb(t) AS row FROM password_reset_tokens t ORDER BY id")).rows };
  }
  async function account(userId = id(1)) { return (await pool.query("SELECT * FROM users WHERE id=$1", [userId])).rows[0]; }
  async function waitForBlocked(count: number) {
    await vi.waitFor(async () => expect((await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1 AND application_name='h14_auth_test' AND wait_event_type='Lock'", [name])).rows[0].count).toBe(count), { timeout: 5000, interval: 20 });
  }

  it("resets once, consumes outstanding tokens, preserves bcrypt cost, and accepts only the new password", async () => {
    const reset = await createPasswordResetToken(id(1)); const sibling = await createPasswordResetToken(id(1));
    expect(new Date(reset.expiresAt).getTime()-Date.now()).toBeGreaterThan(3590000);
    expect(new Date(reset.expiresAt).getTime()-Date.now()).toBeLessThanOrEqual(3600000);
    expect(await resetPasswordWithToken({ token: reset.token, password: newPassword })).toEqual({ ok: true, reason: "reset", userId: id(1) });
    expect((await account()).session_version).toBe(1); expect((await account()).password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect((await pool.query("SELECT count(*)::int AS count FROM password_reset_tokens WHERE used_at IS NULL")).rows[0].count).toBe(0);
    const before = await data();
    expect((await resetPasswordWithToken({ token: reset.token, password: "SecondPassword!789" })).ok).toBe(false);
    expect((await resetPasswordWithToken({ token: sibling.token, password: "SecondPassword!789" })).ok).toBe(false);
    expect(await data()).toEqual(before);
    expect(await session((await login(oldPassword)).cookie)).toBeNull();
    expect(await session((await login(newPassword)).cookie)).toMatchObject({ user: { id: id(1) } });
  });

  it("permits exactly one winner when the same token is claimed concurrently", async () => {
    const reset = await createPasswordResetToken(id(1));
    const blocker = await pool.connect(); await blocker.query("BEGIN"); await blocker.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [id(1)]);
    const choices = [newPassword, "OtherConcurrentPassword!789"];
    const requests = Promise.all(choices.map((password) => resetPasswordWithToken({ token: reset.token, password })));
    try { await waitForBlocked(2); } finally { await blocker.query("COMMIT"); blocker.release(); }
    const results = await requests; expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "invalid" }]);
    const stored = await account(); expect(stored.session_version).toBe(1);
    const accepted = await Promise.all(choices.map((password) => passwords.verifyPassword(password, stored.password_hash)));
    expect(accepted).toEqual(results.map((r) => r.ok));
    expect(await passwords.verifyPassword(oldPassword, stored.password_hash)).toBe(false);
  });

  it("serializes different outstanding tokens for one user without partial resets or deadlock", async () => {
    const resets = await Promise.all([createPasswordResetToken(id(1)), createPasswordResetToken(id(1))]);
    const results = await Promise.all(resets.map((r, n) => resetPasswordWithToken({ token: r.token, password: `${newPassword}${n}` })));
    expect(results.filter((r) => r.ok)).toHaveLength(1); expect((await account()).session_version).toBe(1);
  });

  it("rejects old cookies on protected pages/APIs after reset and permits a new login", async () => {
    vi.stubEnv("BILLING_ENFORCEMENT", "on");
    const first = await login(); const second = await login();
    expect(first.jar.has(cookieName)).toBe(true); state.cookie = first.cookie;
    expect((await requireUser()).id).toBe(id(1));
    expect(await DashboardLayout({ children: null })).toBeTruthy(); expect((await invoiceExport()).status).toBe(200);
    const reset = await createPasswordResetToken(id(1));
    expect((await resetPasswordWithToken({ token: reset.token, password: newPassword })).ok).toBe(true);
    for (const old of [first.cookie,second.cookie]) {
      state.cookie = old; expect(await auth()).toBeNull(); expect(await session(old)).toBeNull();
      await expect(DashboardLayout({ children: null })).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
      await expect(invoiceExport()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
      expect((await checkout(new Request(`${baseUrl}/api/payfast/checkout`))).headers.get("location")).toBe(`${baseUrl}/login`);
    }
    const current = await login(newPassword); state.cookie = current.cookie;
    expect((await requireUser()).id).toBe(id(1)); expect((await invoiceExport()).status).toBe(200);
    expect((await checkout(new Request(`${baseUrl}/api/payfast/checkout`))).headers.get("location")).toContain("/dashboard/billing?");
    const payload = await decode({ token: current.jar.get(cookieName), salt: cookieName, secret: process.env.AUTH_SECRET! });
    expect(payload?.sessionVersion).toBe(1); expect(payload!.exp!-payload!.iat!).toBe(30*24*60*60);
  });

  it("preserves pre-rollout JWTs until reset and never upgrades them on refresh", async () => {
    const legacy = await encode({ secret: process.env.AUTH_SECRET!, salt: cookieName, token: { sub: id(1), email: "one@example.test" } });
    const cookie = `${cookieName}=${legacy}`; state.cookie = cookie;
    expect((await requireUser()).id).toBe(id(1)); expect(await session(cookie)).toMatchObject({ user: { id: id(1) } });
    const reset = await createPasswordResetToken(id(1)); await resetPasswordWithToken({ token: reset.token, password: newPassword });
    expect(await session(cookie)).toBeNull(); expect(await auth()).toBeNull();
    const jar = new Map([[cookieName, legacy]]); const csrfToken = await csrf(jar);
    const response = await handlers.POST(new NextRequest(`${baseUrl}/api/auth/session`, { method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader(jar) }, body: JSON.stringify({ csrfToken, data: { sessionVersion: 1 } }) }));
    expect(await response.json()).toBeNull();
    expect((await account()).session_version).toBe(1);
  });

  it.each(["invalid", "expired", "used"] as const)("rejects %s tokens without changing credentials, versions or token state", async (kind) => {
    const reset = await createPasswordResetToken(id(1));
    if (kind === "expired") await pool.query("UPDATE password_reset_tokens SET expires_at=now()-interval '1 second'");
    if (kind === "used") await pool.query("UPDATE password_reset_tokens SET used_at=now()");
    const before = await data();
    expect(await resetPasswordWithToken({ token: kind === "invalid" ? "not-a-real-token" : reset.token, password: newPassword }))
      .toEqual({ ok: false, reason: kind === "expired" ? "expired" : "invalid" });
    expect(await data()).toEqual(before);
  });

  it("rechecks expiry after waiting for the user lock instead of using transaction-start time", async () => {
    const reset = await createPasswordResetToken(id(1));
    await pool.query("UPDATE password_reset_tokens SET expires_at=clock_timestamp()+interval '0.5 seconds'");
    const before = await data(); const blocker = await pool.connect(); await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [id(1)]);
    const request = resetPasswordWithToken({ token: reset.token, password: newPassword });
    try { await waitForBlocked(1); await pool.query("SELECT pg_sleep(0.6)"); } finally { await blocker.query("COMMIT"); blocker.release(); }
    expect(await request).toEqual({ ok: false, reason: "expired" }); expect(await data()).toEqual(before);
  });

  it.each(["users", "password_reset_tokens"] as const)("rolls back claim/password/version if %s persistence fails, then retries cleanly", async (table) => {
    const reset = await createPasswordResetToken(id(1)); await createPasswordResetToken(id(1));
    const before = await data(); const oldSession = await login();
    const siblingId = (await pool.query("SELECT id FROM password_reset_tokens ORDER BY created_at DESC LIMIT 1")).rows[0].id;
    await pool.query(`CREATE FUNCTION h14_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic H14 failure'; END $$;
      CREATE TRIGGER h14_fail AFTER UPDATE ON ${table} FOR EACH ROW ${table === "password_reset_tokens" ? `WHEN (NEW.id = '${siblingId}'::uuid)` : ""} EXECUTE FUNCTION h14_fail()`);
    await expect(resetPasswordWithToken({ token: reset.token, password: newPassword })).rejects.toThrow();
    expect(await data()).toEqual(before); state.cookie = oldSession.cookie; expect((await requireUser()).id).toBe(id(1));
    await pool.query(`DROP TRIGGER h14_fail ON ${table}; DROP FUNCTION h14_fail()`);
    expect((await resetPasswordWithToken({ token: reset.token, password: newPassword })).ok).toBe(true);
    expect((await account()).session_version).toBe(1); expect(await auth()).toBeNull();
  });

  it("does not modify another user, consume their tokens or revoke their cookie", async () => {
    const otherSession = await login(oldPassword, "two@example.test"); const otherToken = await createPasswordResetToken(id(2));
    const otherBefore = await account(id(2)); const tokensBefore = (await pool.query("SELECT * FROM password_reset_tokens WHERE user_id=$1", [id(2)])).rows;
    const reset = await createPasswordResetToken(id(1)); await resetPasswordWithToken({ token: reset.token, password: newPassword });
    expect(await account(id(2))).toEqual(otherBefore);
    expect((await pool.query("SELECT * FROM password_reset_tokens WHERE user_id=$1", [id(2)])).rows).toEqual(tokensBefore);
    state.cookie = otherSession.cookie; expect((await requireUser()).id).toBe(id(2));
    expect((await resetPasswordWithToken({ token: otherToken.token, password: "OtherUsersNewPassword!" })).ok).toBe(true);
    expect((await account()).session_version).toBe(1);
  });

  it("preserves normal login/logout and JWT expiry while requiring independent email verification", async () => {
    const current = await login(); state.cookie = current.cookie; expect((await requireUser()).id).toBe(id(1));
    const csrfToken = await csrf(current.jar);
    const response = await handlers.POST(new NextRequest(`${baseUrl}/api/auth/signout`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(current.jar) }, body: new URLSearchParams({ csrfToken }).toString() }));
    mergeCookies(current.jar,response); expect(current.jar.has(cookieName)).toBe(false); expect(await session(cookieHeader(current.jar))).toBeNull();
    const expired = await encode({ secret: process.env.AUTH_SECRET!, salt: cookieName, maxAge: -60, token: { sub: id(1), sessionVersion: 0 } });
    expect(await session(`${cookieName}=${expired}`)).toBeNull();
    await pool.query("UPDATE users SET email_verified_at=null WHERE id=$1", [id(1)]);
    state.cookie = (await login()).cookie;
    expect(await auth()).toBeNull();
    await expect(requireUser()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
    const reset = await createPasswordResetToken(id(1)); await resetPasswordWithToken({ token: reset.token, password: newPassword });
    expect((await account()).email_verified_at).toBeNull();
    expect(await session((await login(newPassword)).cookie)).toBeNull();
    const verification = await createEmailVerificationToken(id(1));
    expect((await verifyEmailToken(verification.token)).ok).toBe(true);
    state.cookie = (await login(newPassword)).cookie; expect((await requireUser()).id).toBe(id(1));
  }, 15000);

  it("keeps authenticated access available with disabled billing and expired account dates", async () => {
    vi.stubEnv("BILLING_ENFORCEMENT", "off"); vi.stubEnv("KEY_FEATURE_TRIAL_LOCK", "on");
    state.cookie = (await login()).cookie;
    for (const status of ["trialing", "active", "past_due", "cancelled"]) {
      await pool.query("UPDATE businesses SET subscription_status=$1,trial_ends_at='2000-01-01',current_period_end='2000-01-01' WHERE owner_id=$2", [status,id(1)]);
      expect((await requirePaidBusiness()).id).toBe(id(3));
      expect((await invoiceExport()).status).toBe(200);
    }
  });

  it("does not grant a current session to an old-password login racing with reset", async () => {
    const reset = await createPasswordResetToken(id(1));
    const verify = passwords.verifyPassword;
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
    let verified!: () => void; const reached = new Promise<void>((resolve) => { verified = resolve; });
    vi.spyOn(passwords, "verifyPassword").mockImplementationOnce(async (password, hash) => {
      const result = await verify(password, hash); verified(); await gate; return result;
    });
    const pending = login();
    try { await reached; expect((await resetPasswordWithToken({ token: reset.token, password: newPassword })).ok).toBe(true); }
    finally { release(); }
    expect(await session((await pending).cookie)).toBeNull();
    expect(await session((await login(newPassword)).cookie)).toMatchObject({ user: { id: id(1) } });
  });
});
