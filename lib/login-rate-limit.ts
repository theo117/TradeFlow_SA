import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginRateLimits } from "@/lib/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

export function buildLoginThrottleKey(email: string, ip: string | null) {
  return `${email.toLowerCase()}::${ip ?? "unknown"}`;
}

function isMissingRelationError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes('relation "login_rate_limits" does not exist') ||
      error.message.includes('column "blocked_until" does not exist') ||
      error.message.includes('column "attempt_count" does not exist'))
  );
}

export async function isLoginBlocked(key: string) {
  try {
    const [row] = await db
      .select({ blockedUntil: loginRateLimits.blockedUntil })
      .from(loginRateLimits)
      .where(eq(loginRateLimits.identifier, key))
      .limit(1);

    return Boolean(
      row?.blockedUntil && new Date(row.blockedUntil).getTime() > Date.now()
    );
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn("Login rate limit table is missing; allowing login flow to continue.");
      return false;
    }

    throw error;
  }
}

export async function recordFailedLogin(key: string) {
  try {
    const now = Date.now();
    const [row] = await db
      .select()
      .from(loginRateLimits)
      .where(eq(loginRateLimits.identifier, key))
      .limit(1);

    if (!row) {
      await db.insert(loginRateLimits).values({
        identifier: key,
        attemptCount: 1,
        windowStartedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
      });
      return;
    }

    const windowStartedAt = new Date(row.windowStartedAt).getTime();
    const withinWindow = windowStartedAt + WINDOW_MS > now;
    const attemptCount = withinWindow ? row.attemptCount + 1 : 1;
    const blockedUntil =
      attemptCount >= MAX_ATTEMPTS
        ? new Date(now + BLOCK_MS).toISOString()
        : row.blockedUntil && new Date(row.blockedUntil).getTime() > now
          ? row.blockedUntil
          : null;

    await db
      .update(loginRateLimits)
      .set({
        attemptCount,
        windowStartedAt: withinWindow
          ? row.windowStartedAt
          : new Date(now).toISOString(),
        blockedUntil,
        updatedAt: new Date(now).toISOString()
      })
      .where(eq(loginRateLimits.identifier, key));
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn("Login rate limit table is missing; failed login was not recorded.");
      return;
    }

    throw error;
  }
}

export async function clearFailedLogin(key: string) {
  try {
    await db.delete(loginRateLimits).where(eq(loginRateLimits.identifier, key));
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn("Login rate limit table is missing; clear failed login was skipped.");
      return;
    }

    throw error;
  }
}
