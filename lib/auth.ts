import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import type { Business } from "@/lib/types";

export async function requireUser() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect("/login");
  }

  return user;
}

export async function requireBusiness() {
  const user = await requireUser();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, user.id))
    .limit(1);

  if (!business) {
    redirect("/register");
  }

  return {
    id: business.id,
    owner_id: business.ownerId,
    name: business.name,
    email: business.email,
    phone: business.phone,
    address: business.address,
    logo_url: business.logoUrl,
    vat_number: business.vatNumber,
    registration_number: business.registrationNumber,
    bank_name: business.bankName,
    bank_account_name: business.bankAccountName,
    bank_account_number: business.bankAccountNumber,
    bank_branch_code: business.bankBranchCode,
    payment_instructions: business.paymentInstructions,
    billing_provider: business.billingProvider,
    billing_customer_id: business.billingCustomerId,
    billing_subscription_id: business.billingSubscriptionId,
    billing_plan_id: business.billingPlanId,
    subscription_status: business.subscriptionStatus,
    current_period_end: business.currentPeriodEnd,
    trial_ends_at: business.trialEndsAt,
    created_at: business.createdAt
  };
}

export function hasBillingAccess(business: Business) {
  // Early-access mode: billing is not enforced yet.
  void business;
  return true;
}

export async function requirePaidBusiness() {
  return requireBusiness();
}
