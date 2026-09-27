import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { logWarn } from "@/lib/observability";

type RateLimitOptions = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
  blockMs?: number;
  failClosed?: boolean;
};

export type RateLimitResult = {
  blocked: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

function isMissingRelationError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes('relation "rate_limits" does not exist') ||
      error.message.includes('column "blocked_until" does not exist') ||
      error.message.includes('column "attempt_count" does not exist'))
  );
}

export function buildRateLimitKey(namespace: string, parts: Array<string | null>) {
  return `${namespace}:${parts.map((part) => part || "unknown").join(":")}`;
}

export async function consumeRateLimit({
  namespace,
  key,
  limit,
  windowMs,
  blockMs = windowMs,
  failClosed = false
}: RateLimitOptions): Promise<RateLimitResult> {
  const identifier = buildRateLimitKey(namespace, [key]);
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
  async function consume(store: Transaction | typeof db): Promise<RateLimitResult> {
    const now = Date.now();
    const [row] = await store
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.identifier, identifier))
      .limit(1);

    if (row?.blockedUntil && new Date(row.blockedUntil).getTime() > now) {
      return {
        blocked: true,
        remaining: 0,
        retryAfterSeconds: Math.ceil(
          (new Date(row.blockedUntil).getTime() - now) / 1000
        )
      };
    }

    if (!row) {
      await store.insert(rateLimits).values({
        identifier,
        attemptCount: 1,
        windowStartedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
      });
      return { blocked: false, remaining: Math.max(limit - 1, 0) };
    }

    const windowStartedAt = new Date(row.windowStartedAt).getTime();
    const withinWindow = windowStartedAt + windowMs > now;
    const attemptCount = withinWindow ? row.attemptCount + 1 : 1;
    const blocked = attemptCount > limit;
    const blockedUntil = blocked ? new Date(now + blockMs).toISOString() : null;

    await store
      .update(rateLimits)
      .set({
        attemptCount,
        windowStartedAt: withinWindow
          ? row.windowStartedAt
          : new Date(now).toISOString(),
        blockedUntil,
        updatedAt: new Date(now).toISOString()
      })
      .where(eq(rateLimits.identifier, identifier));

    return {
      blocked,
      remaining: blocked ? 0 : Math.max(limit - attemptCount, 0),
      retryAfterSeconds: blocked ? Math.ceil(blockMs / 1000) : undefined
    };
  }
  try {
    if (failClosed) {
      // Auth actions opt into serialized, fail-closed consumption. Other users
      // of this helper retain their existing behavior.
      return await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identifier}, 0))`);
        return consume(tx);
      });
    }
    return await consume(db);
  } catch (error) {
    if (!failClosed && isMissingRelationError(error)) {
      logWarn("Rate limit table is missing; request was allowed.", {
        namespace
      });
      return { blocked: false, remaining: limit };
    }

    throw error;
  }
}
