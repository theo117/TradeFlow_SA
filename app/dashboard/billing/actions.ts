"use server";

import { redirect } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing-access";
import type { BillingPlan } from "@/lib/payfast";

export async function startBillingCheckout(plan: BillingPlan) {
  if (!isBillingEnabled()) redirect("/dashboard/billing");
  redirect(`/api/payfast/checkout?plan=${plan}`);
}
