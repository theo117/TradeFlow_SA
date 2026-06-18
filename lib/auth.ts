import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";
import type { Business } from "@/lib/types";
import { logError, logWarn } from "@/lib/observability";

const DEFAULT_KEY_FEATURE_TRIAL_DAYS = 3;
type AccessControlledBusiness = Pick<
  Business,
  "subscription_status" | "current_period_end" | "trial_ends_at" | "created_at"
>;

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

  if (!storedUser?.emailVerifiedAt) {
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

export function hasBillingAccess(business: AccessControlledBusiness) {
  if (
    process.env.KEY_FEATURE_TRIAL_LOCK !== "off" &&
    business.subscription_status === "trialing"
  ) {
    return hasFutureDate(business.trial_ends_at ?? getFallbackTrialEnd(business.created_at));
  }

  if (process.env.BILLING_ENFORCEMENT !== "on") {
    return true;
  }

  if (business.subscription_status === "active") {
    return hasFutureDate(business.current_period_end);
  }

  if (business.subscription_status === "trialing") {
    return hasFutureDate(business.trial_ends_at ?? getFallbackTrialEnd(business.created_at));
  }

  return false;
}

export function getKeyFeatureTrialDays() {
  const configuredDays = Number(process.env.KEY_FEATURE_TRIAL_DAYS);

  return Number.isFinite(configuredDays) && configuredDays > 0
    ? configuredDays
    : DEFAULT_KEY_FEATURE_TRIAL_DAYS;
}

export function getFallbackTrialEnd(createdAt: string) {
  const trialEnd = new Date(createdAt);
  trialEnd.setDate(trialEnd.getDate() + getKeyFeatureTrialDays());
  return trialEnd.toISOString();
}

export function getAccessEndsAt(business: AccessControlledBusiness) {
  if (business.subscription_status === "active") {
    return business.current_period_end;
  }

  if (business.subscription_status === "trialing") {
    return business.trial_ends_at ?? getFallbackTrialEnd(business.created_at);
  }

  return business.current_period_end ?? business.trial_ends_at;
}

export function getAccessState(business: AccessControlledBusiness) {
  return {
    hasAccess: hasBillingAccess(business),
    accessEndsAt: getAccessEndsAt(business),
    trialDays: getKeyFeatureTrialDays()
  };
}

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

function hasFutureDate(value: string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}
