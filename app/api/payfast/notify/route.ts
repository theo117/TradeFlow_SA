import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import {
  getPlanAmount,
  type BillingPlan,
  validatePayfastNotification
} from "@/lib/payfast";

export const runtime = "nodejs";

function parsePlan(value: string | null): BillingPlan | null {
  if (value === "starter" || value === "pro") {
    return value;
  }

  return null;
}

function addMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const signature = params.get("signature");
  const isValid = await validatePayfastNotification(body, signature);

  if (!isValid) {
    return new NextResponse("Invalid ITN", { status: 400 });
  }

  const businessId = params.get("custom_str1");
  const plan = parsePlan(params.get("custom_str2"));
  const paymentStatus = params.get("payment_status");
  const amountGross = params.get("amount_gross");
  const pfPaymentId = params.get("pf_payment_id");

  if (!businessId || !plan || paymentStatus !== "COMPLETE") {
    return NextResponse.json({ received: true });
  }

  if (Number(amountGross ?? 0).toFixed(2) !== getPlanAmount(plan)) {
    return new NextResponse("Invalid payment amount", { status: 400 });
  }

  await db
    .update(businesses)
    .set({
      billingProvider: "payfast",
      billingCustomerId: params.get("email_address"),
      billingSubscriptionId: pfPaymentId,
      billingPlanId: plan,
      subscriptionStatus: "active",
      currentPeriodEnd: addMonth(new Date())
    })
    .where(eq(businesses.id, businessId));

  return NextResponse.json({ received: true });
}
