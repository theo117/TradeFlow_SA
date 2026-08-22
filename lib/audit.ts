import { db } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";
import { logError } from "@/lib/observability";
import { assertProductionEnv } from "@/lib/env";




export async function logAuditEvent({
  businessId,
  userId,
  action,
  entityType,
  entityId,
  ip,
  metadata
}: {
  businessId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}) {

  assertProductionEnv();

  try {
    await db.insert(auditEvents).values({
      businessId: businessId ?? null,
      userId: userId ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      ip: ip ?? null,
      metadata: metadata ?? null
    });
  } catch (error) {
    logError("Audit event logging failed", error, { action, entityId });
  }
}
