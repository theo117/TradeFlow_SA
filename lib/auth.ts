import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";
import { logError, logWarn } from "@/lib/observability";
import {
  getAccessEndsAt,
  getAccessState,
  getFallbackTrialEnd,
  getKeyFeatureTrialDays,
  hasBillingAccess
} from "@/lib/billing-access";

export async function requireUser() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect("/login");
  }

  const [storedUser] = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!storedUser) {
    logWarn("Orphaned user session rejected", { userId: user.id });
    redirect(
      "/login?error=Your%20session%20is%20no%20longer%20valid.%20Please%20log%20in%20again."
    );
  }

  if (!storedUser.emailVerifiedAt) {
    logWarn("Unverified user session rejected", { userId: user.id });
    redirect("/login?code=email_not_verified");
  }

  return user;
}

export async function requireBusiness() {
  const user = await requireUser();
  let business;

  try {
    [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, user.id))
      .limit(1);
  } catch (error) {
    logError("Business lookup failed", error, { userId: user.id });
    throw error;
  }

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
    whatsapp_phone_number_id: business.whatsappPhoneNumberId,
    whatsapp_business_account_id: business.whatsappBusinessAccountId,
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

export {
  getAccessEndsAt,
  getAccessState,
  getFallbackTrialEnd,
  getKeyFeatureTrialDays,
  hasBillingAccess
};

export async function requirePaidBusiness() {
  const business = await requireBusiness();

  if (!hasBillingAccess(business)) {
    logWarn("Billing access denied", {
      businessId: business.id,
      subscriptionStatus: business.subscription_status,
      currentPeriodEnd: business.current_period_end,
      trialEndsAt: business.trial_ends_at
    });
    redirect("/dashboard/billing?error=Billing%20required");
  }

  return business;
}
