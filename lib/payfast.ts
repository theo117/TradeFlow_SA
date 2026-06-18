import { createHash } from "crypto";

export type BillingPlan = "starter" | "pro";
export type PayfastPaymentStatus = "COMPLETE" | "FAILED" | "CANCELLED";

type PayfastFieldValue = string | number | undefined | null;

export function getPayfastConfig() {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;

  if (!merchantId || !merchantKey || !passphrase) {
    throw new Error("Payfast environment variables are not configured.");
  }

  return {
    merchantId,
    merchantKey,
    passphrase,
    processUrl:
      process.env.PAYFAST_PROCESS_URL ?? "https://www.payfast.co.za/eng/process",
    validateUrl:
      process.env.PAYFAST_VALIDATE_URL ?? "https://www.payfast.co.za/eng/query/validate"
  };
}

export function getPlanAmount(plan: BillingPlan) {
  const rawAmount =
    plan === "starter"
      ? process.env.PAYFAST_PLAN_STARTER_AMOUNT
      : process.env.PAYFAST_PLAN_PRO_AMOUNT;

  if (!rawAmount) {
    throw new Error(`Payfast amount for ${plan} is not configured.`);
  }

  const amount = Number(rawAmount);

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid Payfast amount configured for ${plan}.`);
  }

  return amount.toFixed(2);
}

export function getPlanLabel(plan: BillingPlan) {
  return plan === "starter" ? "Starter" : "Pro";
}

export function createPayfastSignature(
  fields: Record<string, PayfastFieldValue>,
  passphrase: string
) {
  const payload = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(
      ([key, value]) =>
        `${key}=${encodeURIComponent(String(value)).replace(/%20/g, "+")}`
    )
    .join("&");

  return createHash("md5")
    .update(`${payload}&passphrase=${encodeURIComponent(passphrase)}`)
    .digest("hex");
}

export function parsePayfastPaymentStatus(
  value: string | null
): PayfastPaymentStatus | null {
  if (value === "COMPLETE" || value === "FAILED" || value === "CANCELLED") {
    return value;
  }

  return null;
}

export function getSubscriptionStatusForPayfastPayment(
  status: PayfastPaymentStatus
) {
  if (status === "COMPLETE") {
    return "active";
  }

  if (status === "FAILED") {
    return "past_due";
  }

  return "cancelled";
}

export function addBillingMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

export async function validatePayfastNotification(
  body: string,
  signature: string | null
) {
  if (!signature) {
    return false;
  }

  const { passphrase, validateUrl } = getPayfastConfig();
  const params = new URLSearchParams(body);
  const fields = Object.fromEntries(params.entries());
  const expectedSignature = createPayfastSignature(
    Object.fromEntries(
      Object.entries(fields).filter(([key]) => key !== "signature")
    ),
    passphrase
  );

  if (expectedSignature !== signature) {
    return false;
  }

  const validationBody = Object.entries(fields)
    .filter(([key]) => key !== "signature")
    .map(
      ([key, value]) =>
        `${key}=${encodeURIComponent(value).replace(/%20/g, "+")}`
    )
    .join("&");

  const response = await fetch(validateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: validationBody
  });

  const text = (await response.text()).trim().toUpperCase();
  return response.ok && text === "VALID";
}
