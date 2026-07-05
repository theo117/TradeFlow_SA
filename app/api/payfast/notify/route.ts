import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, payfastItnEvents } from "@/lib/db/schema";
import {
  addBillingMonth,
  getSubscriptionStatusForPayfastPayment,
  getPlanAmount,
  parsePayfastPaymentStatus,
  type BillingPlan,
  validatePayfastNotification
} from "@/lib/payfast";
import { logAuditEvent } from "@/lib/audit";
import {
  getRequestLogContext,
  logError,
  logInfo,
  logWarn
} from "@/lib/observability";
import { recordPayfastItnEvent } from "@/lib/payfast-itn-events";
import { buildRateLimitKey, consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePlan(value: string | null): BillingPlan | null {
  if (value === "starter" || value === "pro") {
    return value;
  }

  return null;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestContext = getRequestLogContext(request);
  const body = await request.text();
  const params = new URLSearchParams(body);
  const signature = params.get("signature");
  const paymentId = params.get("m_payment_id");
  const pfPaymentId = params.get("pf_payment_id");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limit = await consumeRateLimit({
    namespace: "webhook.payfast",
    key: buildRateLimitKey("payfast", [ip, pfPaymentId, paymentId]),
    limit: 120,
    windowMs: 15 * 60 * 1000
  });

  if (limit.blocked) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds ?? 900)
      }
    });
  }

  logInfo("Payfast ITN received", {
    ...requestContext,
    paymentId,
    pfPaymentId,
    paymentStatus: params.get("payment_status")
  });

  const isValid = await validatePayfastNotification(body, signature);

  if (!isValid) {
    await recordPayfastItnEvent({
      body,
      params,
      signature,
      validationStatus: "invalid",
      ignoredReason: "signature_or_payfast_validation_failed"
    });
    await logAuditEvent({
      action: "billing.payfast_itn_invalid",
      entityType: "payfast_itn",
      entityId: paymentId,
      metadata: {
        paymentStatus: params.get("payment_status"),
        pfPaymentId
      }
    });
    logWarn("Payfast ITN rejected", {
      ...requestContext,
      paymentId,
      pfPaymentId,
      ms: Date.now() - startedAt
    });
    return new NextResponse("Invalid ITN", { status: 400 });
  }

  const businessId = params.get("custom_str1");
  const plan = parsePlan(params.get("custom_str2"));
  const paymentStatus = parsePayfastPaymentStatus(params.get("payment_status"));
  const amountGross = params.get("amount_gross");

  if (!businessId || !plan || !paymentStatus) {
    await recordPayfastItnEvent({
      body,
      params,
      signature,
      validationStatus: "ignored",
      businessId,
      plan,
      paymentStatus,
      ignoredReason: "missing_business_plan_or_status"
    });
    await logAuditEvent({
      action: "billing.payfast_itn_ignored",
      entityType: "payfast_itn",
      entityId: paymentId,
      metadata: {
        businessId,
        plan: params.get("custom_str2"),
        paymentStatus: params.get("payment_status"),
        pfPaymentId
      }
    });
    logWarn("Payfast ITN ignored", {
      ...requestContext,
      paymentId,
      pfPaymentId,
      businessId,
      plan: params.get("custom_str2"),
      paymentStatus: params.get("payment_status"),
      ms: Date.now() - startedAt
    });
    return NextResponse.json({ received: true });
  }

  if (
    paymentStatus === "COMPLETE" &&
    Number(amountGross ?? 0).toFixed(2) !== getPlanAmount(plan)
  ) {
    await recordPayfastItnEvent({
      body,
      params,
      signature,
      validationStatus: "ignored",
      businessId,
      plan,
      paymentStatus,
      ignoredReason: "amount_mismatch"
    });
    await logAuditEvent({
      action: "billing.payfast_itn_amount_mismatch",
      entityType: "business",
      entityId: businessId,
      metadata: {
        amountGross,
        expectedAmount: getPlanAmount(plan),
        paymentStatus,
        pfPaymentId
      }
    });
    logError("Payfast ITN amount mismatch", undefined, {
      ...requestContext,
      paymentId,
      pfPaymentId,
      businessId,
      amountGross,
      expectedAmount: getPlanAmount(plan),
      ms: Date.now() - startedAt
    });
    return new NextResponse("Invalid payment amount", { status: 400 });
  }

  const subscriptionStatus =
    getSubscriptionStatusForPayfastPayment(paymentStatus);

  if (pfPaymentId) {
    const [existingEvent] = await db
      .select({ id: payfastItnEvents.id })
      .from(payfastItnEvents)
      .where(
        and(
          eq(payfastItnEvents.pfPaymentId, pfPaymentId),
          eq(payfastItnEvents.paymentStatus, paymentStatus),
          isNotNull(payfastItnEvents.processedAt)
        )
      )
      .limit(1);

    if (existingEvent) {
      await recordPayfastItnEvent({
        body,
        params,
        signature,
        validationStatus: "duplicate",
        businessId,
        plan,
        paymentStatus,
        ignoredReason: "duplicate_pf_payment_status"
      });
      logInfo("Payfast ITN duplicate ignored", {
        ...requestContext,
        paymentId,
        pfPaymentId,
        businessId,
        paymentStatus,
        ms: Date.now() - startedAt
      });
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  const updated = await db
    .update(businesses)
    .set({
      billingProvider: "payfast",
      billingCustomerId: params.get("email_address"),
      billingSubscriptionId: pfPaymentId,
      billingPlanId: plan,
      subscriptionStatus,
      currentPeriodEnd:
        paymentStatus === "COMPLETE" ? addBillingMonth(new Date()) : undefined
    })
    .where(eq(businesses.id, businessId))
    .returning({ id: businesses.id });

  if (updated.length === 0) {
    await recordPayfastItnEvent({
      body,
      params,
      signature,
      validationStatus: "ignored",
      businessId,
      plan,
      paymentStatus,
      ignoredReason: "business_not_found"
    });
    logWarn("Payfast ITN ignored because business was not found", {
      ...requestContext,
      paymentId,
      pfPaymentId,
      businessId,
      ms: Date.now() - startedAt
    });
    return NextResponse.json({ received: true });
  }

  await recordPayfastItnEvent({
    body,
    params,
    signature,
    validationStatus: "valid",
    businessId,
    plan,
    paymentStatus
  });

  await logAuditEvent({
    action: "billing.payfast_itn_processed",
    entityType: "business",
    entityId: businessId,
    metadata: {
      plan,
      paymentStatus,
      subscriptionStatus,
      pfPaymentId
    }
  });

  logInfo("Payfast ITN processed", {
    ...requestContext,
    paymentId,
    pfPaymentId,
    businessId,
    plan,
    paymentStatus,
    subscriptionStatus,
    ms: Date.now() - startedAt
  });

  return NextResponse.json({ received: true });
}
