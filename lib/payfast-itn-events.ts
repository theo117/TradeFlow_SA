import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payfastItnEvents } from "@/lib/db/schema";
import type { BillingPlan, PayfastPaymentStatus } from "@/lib/payfast";
import { logWarn } from "@/lib/observability";

type RecordItnInput = {
  body: string;
  params: URLSearchParams;
  signature: string | null;
  validationStatus: "valid" | "invalid" | "ignored" | "duplicate" | "error";
  businessId?: string | null;
  plan?: BillingPlan | null;
  paymentStatus?: PayfastPaymentStatus | null;
  ignoredReason?: string | null;
};

function isMissingRelationError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes('relation "payfast_itn_events" does not exist')
  );
}

function hashSignature(signature: string | null) {
  if (!signature) {
    return null;
  }

  return createHash("sha256").update(signature).digest("hex");
}

export async function recordPayfastItnEvent({
  body,
  params,
  signature,
  validationStatus,
  businessId = params.get("custom_str1"),
  plan,
  paymentStatus,
  ignoredReason
}: RecordItnInput) {
  try {
    const [event] = await db
      .insert(payfastItnEvents)
      .values({
        paymentId: params.get("m_payment_id"),
        pfPaymentId: params.get("pf_payment_id"),
        businessId: businessId || null,
        plan: plan ?? params.get("custom_str2"),
        paymentStatus: paymentStatus ?? params.get("payment_status"),
        amountGross: params.get("amount_gross")
          ? Number(params.get("amount_gross"))
          : null,
        signatureHash: hashSignature(signature),
        validationStatus,
        rawBody: body,
        processedAt:
          validationStatus === "valid" ? new Date().toISOString() : null,
        ignoredReason: ignoredReason ?? null
      })
      .returning({ id: payfastItnEvents.id });

    return event?.id ?? null;
  } catch (error) {
    if (isMissingRelationError(error)) {
      logWarn("Payfast ITN event table is missing; event was not persisted.");
      return null;
    }

    throw error;
  }
}

export async function markPayfastItnIgnored(id: string, reason: string) {
  try {
    await db
      .update(payfastItnEvents)
      .set({
        validationStatus: "ignored",
        ignoredReason: reason
      })
      .where(eq(payfastItnEvents.id, id));
  } catch (error) {
    if (isMissingRelationError(error)) {
      logWarn("Payfast ITN event table is missing; ignored reason not persisted.");
      return;
    }

    throw error;
  }
}
