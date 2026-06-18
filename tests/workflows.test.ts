import { afterEach, describe, expect, it } from "vitest";
import {
  buildInvoiceItemsFromQuoteItems,
  calculateQuoteTotal,
  normalizeRedirectTarget
} from "../lib/workflows";
import { hasBillingAccess } from "../lib/auth";
import {
  addBillingMonth,
  createPayfastSignature,
  getSubscriptionStatusForPayfastPayment,
  parsePayfastPaymentStatus
} from "../lib/payfast";
import type { Business } from "../lib/types";

describe("auth redirect normalization", () => {
  it("keeps safe relative dashboard paths", () => {
    expect(normalizeRedirectTarget("/dashboard/invoices")).toBe("/dashboard/invoices");
  });

  it("falls back when redirect target is invalid", () => {
    expect(normalizeRedirectTarget("https://example.com")).toBe("/dashboard");
    expect(normalizeRedirectTarget(null)).toBe("/dashboard");
  });
});

describe("quote creation totals", () => {
  it("sums item subtotals into the quote total", () => {
    expect(
      calculateQuoteTotal([
        { subtotal: 250 },
        { subtotal: 499.99 },
        { subtotal: 100 }
      ])
    ).toBe(849.99);
  });
});

describe("invoice generation mapping", () => {
  it("maps quote items into invoice line items with sensible descriptions", () => {
    expect(
      buildInvoiceItemsFromQuoteItems([
        {
          serviceId: "svc_1",
          quantity: 2,
          price: 350,
          subtotal: 700,
          service: { name: "Site Visit", description: "On-site inspection" }
        },
        {
          serviceId: "svc_2",
          quantity: 1,
          price: 150,
          subtotal: 150,
          service: { name: null, description: "Replacement part" }
        }
      ])
    ).toEqual([
      {
        serviceId: "svc_1",
        description: "Site Visit",
        quantity: 2,
        price: 350,
        subtotal: 700
      },
      {
        serviceId: "svc_2",
        description: "Replacement part",
        quantity: 1,
        price: 150,
        subtotal: 150
      }
    ]);
  });
});

describe("payfast billing", () => {
  it("creates signatures from the submitted field order", () => {
    expect(
      createPayfastSignature(
        {
          merchant_id: "10000100",
          merchant_key: "46f0cd694581a",
          amount: "199.00",
          item_name: "Starter plan"
        },
        "test passphrase"
      )
    ).toBe("e6ad865c6ac3b3211781828657b4a0ab");
  });

  it("maps ITN payment statuses into subscription statuses", () => {
    expect(parsePayfastPaymentStatus("COMPLETE")).toBe("COMPLETE");
    expect(parsePayfastPaymentStatus("FAILED")).toBe("FAILED");
    expect(parsePayfastPaymentStatus("CANCELLED")).toBe("CANCELLED");
    expect(parsePayfastPaymentStatus("PENDING")).toBeNull();
    expect(getSubscriptionStatusForPayfastPayment("COMPLETE")).toBe("active");
    expect(getSubscriptionStatusForPayfastPayment("FAILED")).toBe("past_due");
    expect(getSubscriptionStatusForPayfastPayment("CANCELLED")).toBe("cancelled");
  });

  it("advances the billing period by one month", () => {
    expect(addBillingMonth(new Date("2026-06-17T12:00:00.000Z"))).toBe(
      "2026-07-17T12:00:00.000Z"
    );
  });
});

describe("billing access", () => {
  const originalBillingEnforcement = process.env.BILLING_ENFORCEMENT;
  const originalTrialLock = process.env.KEY_FEATURE_TRIAL_LOCK;

  function business(overrides: Partial<Business> = {}): Business {
    return {
      id: "business_1",
      owner_id: "user_1",
      name: "Example",
      email: "owner@example.com",
      phone: null,
      address: null,
      logo_url: null,
      whatsapp_phone_number_id: null,
      whatsapp_business_account_id: null,
      vat_number: null,
      registration_number: null,
      bank_name: null,
      bank_account_name: null,
      bank_account_number: null,
      bank_branch_code: null,
      payment_instructions: null,
      billing_provider: null,
      billing_customer_id: null,
      billing_subscription_id: null,
      billing_plan_id: null,
      subscription_status: "trialing",
      current_period_end: null,
      trial_ends_at: null,
      created_at: "2026-06-17T00:00:00.000Z",
      ...overrides
    };
  }

  afterEach(() => {
    process.env.BILLING_ENFORCEMENT = originalBillingEnforcement;
    process.env.KEY_FEATURE_TRIAL_LOCK = originalTrialLock;
  });

  it("allows non-trial businesses while billing enforcement is off", () => {
    process.env.BILLING_ENFORCEMENT = "off";
    process.env.KEY_FEATURE_TRIAL_LOCK = "off";

    expect(hasBillingAccess(business({ subscription_status: "cancelled" }))).toBe(
      true
    );
  });

  it("blocks expired trialing businesses when the key feature lock is on", () => {
    process.env.BILLING_ENFORCEMENT = "off";
    process.env.KEY_FEATURE_TRIAL_LOCK = "on";

    expect(
      hasBillingAccess(
        business({
          subscription_status: "trialing",
          trial_ends_at: "2020-01-01T00:00:00.000Z"
        })
      )
    ).toBe(false);
  });

  it("allows active subscriptions and current trials while enforcement is on", () => {
    process.env.BILLING_ENFORCEMENT = "on";

    expect(
      hasBillingAccess(
        business({
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z"
        })
      )
    ).toBe(true);
    expect(
      hasBillingAccess(
        business({
          subscription_status: "trialing",
          trial_ends_at: "2099-01-01T00:00:00.000Z"
        })
      )
    ).toBe(true);
  });

  it("blocks expired, failed, and cancelled billing states when enforcement is on", () => {
    process.env.BILLING_ENFORCEMENT = "on";

    expect(
      hasBillingAccess(
        business({
          subscription_status: "active",
          current_period_end: "2020-01-01T00:00:00.000Z"
        })
      )
    ).toBe(false);
    expect(hasBillingAccess(business({ subscription_status: "past_due" }))).toBe(
      false
    );
    expect(hasBillingAccess(business({ subscription_status: "cancelled" }))).toBe(
      false
    );
  });
});
