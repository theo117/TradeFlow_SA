import { isBillingEnabled } from "@/lib/billing-access";

const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "PUBLIC_LINK_SECRET"
];



function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isBuildTime() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function assertRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function assertProductionEnv() {
  if (!isProduction()) {
    return;
  }

  // Skip validation during the Next.js build.
  // Runtime validation still happens when the application starts.
  if (isBuildTime()) {
    return;
  }

  // Required environment variables
  const missing = REQUIRED_PRODUCTION_ENV.filter(
    (name) => !process.env[name]?.trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `Production environment is incomplete. Missing: ${missing.join(", ")}`
    );
  }

  // Optional email validation
  const EMAIL_ENABLED = isEmailEnabled();
  const BLOB_ENABLED = process.env.BLOB_ENABLED === "true";

  if (EMAIL_ENABLED) {
    const emailVars = [
      "RESEND_API_KEY",
      "EMAIL_FROM",
    ];

    const missingEmail = emailVars.filter(
      (name) => !process.env[name]?.trim()
    );

    if (missingEmail.length > 0) {
      throw new Error(
        `Email is enabled but missing: ${missingEmail.join(", ")}`
      );
    }
  }

  // Optional blob validation
  if (BLOB_ENABLED && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required when blob storage is enabled."
    );
  }

  // Billing validation
  if (isBillingEnabled()) {
    const billingVars = [
      "PAYFAST_MERCHANT_ID",
      "PAYFAST_MERCHANT_KEY",
      "PAYFAST_PASSPHRASE",
      "PAYFAST_PROCESS_URL",
      "PAYFAST_VALIDATE_URL",
      "PAYFAST_PLAN_STARTER_AMOUNT",
      "PAYFAST_PLAN_PRO_AMOUNT"
    ];

    const missingBilling = billingVars.filter(
      (name) => !process.env[name]?.trim()
    );

    if (missingBilling.length > 0) {
      throw new Error(
        `Billing enforcement cannot be enabled. Missing: ${missingBilling.join(", ")}`
      );
    }
  }
}

export function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (isProduction()) {
    throw new Error("DATABASE_URL is required in production.");
  }

  return "postgres://postgres:postgres@127.0.0.1:5432/tradeflow_sa";
}

// Explicit false wins; absent flags preserve credential-based delivery. A partial
// configuration is considered enabled so startup rejects it instead of failing later.
export function isEmailEnabled() {
  if (process.env.EMAIL_ENABLED === "false") return false;
  return process.env.EMAIL_ENABLED === "true" || Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_FROM);
}

export function getEmailProviderConfig() {
  if (!isEmailEnabled()) return null;
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.EMAIL_FROM?.trim();
  if (resendApiKey && emailFrom) return { resendApiKey, emailFrom };
  throw new Error("Email is enabled but RESEND_API_KEY or EMAIL_FROM is missing.");
}
