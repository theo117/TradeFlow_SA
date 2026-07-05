import type { Business } from "@/lib/types";

const DEFAULT_KEY_FEATURE_TRIAL_DAYS = 3;

type AccessControlledBusiness = Pick<
  Business,
  "subscription_status" | "current_period_end" | "trial_ends_at" | "created_at"
>;

export function hasBillingAccess(business: AccessControlledBusiness) {
  if (
    process.env.KEY_FEATURE_TRIAL_LOCK !== "off" &&
    business.subscription_status === "trialing"
  ) {
    return hasFutureDate(
      business.trial_ends_at ?? getFallbackTrialEnd(business.created_at)
    );
  }

  if (process.env.BILLING_ENFORCEMENT !== "on") {
    return true;
  }

  if (business.subscription_status === "active") {
    return hasFutureDate(business.current_period_end);
  }

  if (business.subscription_status === "trialing") {
    return hasFutureDate(
      business.trial_ends_at ?? getFallbackTrialEnd(business.created_at)
    );
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

function hasFutureDate(value: string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}
