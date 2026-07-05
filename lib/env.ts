const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "PUBLIC_LINK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN"
];

function isProduction() {
  return process.env.NODE_ENV === "production";
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

  const missing = REQUIRED_PRODUCTION_ENV.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Production environment is incomplete. Missing: ${missing.join(", ")}`
    );
  }

  if (process.env.BILLING_ENFORCEMENT === "on") {
    const billingVars = [
      "PAYFAST_MERCHANT_ID",
      "PAYFAST_MERCHANT_KEY",
      "PAYFAST_PASSPHRASE",
      "PAYFAST_PROCESS_URL",
      "PAYFAST_VALIDATE_URL",
      "PAYFAST_PLAN_STARTER_AMOUNT",
      "PAYFAST_PLAN_PRO_AMOUNT"
    ];
    const missingBilling = billingVars.filter((name) => !process.env[name]);

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
