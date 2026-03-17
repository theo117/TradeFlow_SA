"use server";

import { redirect } from "next/navigation";
import type { BillingPlan } from "@/lib/payfast";

export async function startBillingCheckout(plan: BillingPlan) {
  redirect(`/api/payfast/checkout?plan=${plan}`);
}
