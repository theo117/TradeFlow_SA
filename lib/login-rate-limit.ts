import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginRateLimits } from "@/lib/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Outcome<T> = { user: T } | { error: "credentials" | "email_not_verified" };
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function buildLoginThrottleKey(email: string, ip: string | null) {
  return `${email.toLowerCase()}::${ip ?? "unknown"}`;
}

// Use an account-wide key at the credentials boundary: client-controlled proxy
// headers must not provide an alternate login budget. Malformed input shares a
// bounded key. Serialize the check, validation and update across processes.
export async function attemptLogin<T>(key: string, validate: (tx: Transaction) => Promise<Outcome<T>>): Promise<Outcome<T> | { error: "too_many_attempts" }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`auth.login:${key}`}, 0))`);
    const now = Date.now();
    const [row] = await tx.select().from(loginRateLimits).where(eq(loginRateLimits.identifier, key)).limit(1);
    if (row?.blockedUntil && new Date(row.blockedUntil).getTime() > now) return { error: "too_many_attempts" as const };
    const result = await validate(tx);
    if ("user" in result) {
      await tx.delete(loginRateLimits).where(eq(loginRateLimits.identifier, key));
      return result;
    }
    const withinWindow = row && new Date(row.windowStartedAt).getTime() + WINDOW_MS > now;
    const attemptCount = withinWindow ? row.attemptCount + 1 : 1;
    await tx.insert(loginRateLimits).values({
      identifier: key, attemptCount,
      windowStartedAt: withinWindow ? row.windowStartedAt : new Date(now).toISOString(),
      blockedUntil: attemptCount >= MAX_ATTEMPTS ? new Date(now + WINDOW_MS).toISOString() : null,
      updatedAt: new Date(now).toISOString()
    }).onConflictDoUpdate({ target: loginRateLimits.identifier, set: {
      attemptCount, windowStartedAt: withinWindow ? row.windowStartedAt : new Date(now).toISOString(),
      blockedUntil: attemptCount >= MAX_ATTEMPTS ? new Date(now + WINDOW_MS).toISOString() : null,
      updatedAt: new Date(now).toISOString()
    } });
    return result;
  });
}
