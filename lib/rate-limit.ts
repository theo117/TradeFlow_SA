import { sql } from "drizzle-orm";
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
  try {
    // ON CONFLICT locks the existing row and evaluates against its latest value.
    // Active blocks retain the count/window, as in the previous policy.
    const now = sql`clock_timestamp()`;
    const activeBlock = sql`${rateLimits.blockedUntil} > ${now}`;
    const withinWindow = sql`${rateLimits.windowStartedAt} + ${windowMs} * interval '1 millisecond' > ${now}`;
    const attempts = sql`case when ${withinWindow} then ${rateLimits.attemptCount} + 1 else 1 end`;
    const [row] = await db.insert(rateLimits).values({
      identifier, attemptCount: 1, windowStartedAt: now, updatedAt: now
    }).onConflictDoUpdate({
      target: rateLimits.identifier,
      set: {
        attemptCount: sql`case when ${activeBlock} then ${rateLimits.attemptCount} else ${attempts} end`,
        windowStartedAt: sql`case when ${activeBlock} or ${withinWindow} then ${rateLimits.windowStartedAt} else ${now} end`,
        blockedUntil: sql`case when ${activeBlock} then ${rateLimits.blockedUntil} when ${attempts} > ${limit} then ${now} + ${blockMs} * interval '1 millisecond' else null end`,
        updatedAt: now
      }
    }).returning();
    const blocked = !!row.blockedUntil && new Date(row.blockedUntil).getTime() > Date.now();
    return {
      blocked,
      remaining: blocked ? 0 : Math.max(limit - row.attemptCount, 0),
      retryAfterSeconds: blocked ? Math.max(1, Math.ceil((new Date(row.blockedUntil!).getTime() - Date.now()) / 1000)) : undefined
    };
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
