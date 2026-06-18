import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
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

export const runtime = "nodejs";

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

  logInfo("Payfast ITN received", {
    ...requestContext,
    paymentId,
    pfPaymentId,
    paymentStatus: params.get("payment_status")
  });

  const isValid = await validatePayfastNotification(body, signature);

  if (!isValid) {
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

  await db
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
    .where(eq(businesses.id, businessId));

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
