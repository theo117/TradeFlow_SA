import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Business } from "../lib/types";

const state = vi.hoisted(() => ({ dbCalls: 0 }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { state.dbCalls++; throw new Error("Disabled billing must not access the database"); } }) }));
vi.mock("@/auth", () => ({ auth: vi.fn(() => { throw new Error("Disabled checkout must exit before authentication"); }) }));
vi.mock("@/lib/auth", async () => ({
  ...await vi.importActual("../lib/billing-access"),
  requireBusiness: async () => ({ id: "synthetic-business", name: "Synthetic business", subscription_status: "trialing", trial_ends_at: "2000-01-01", current_period_end: null, created_at: "2000-01-01" })
}));

import { GET as checkout } from "../app/api/payfast/checkout/route";
import { POST as notify } from "../app/api/payfast/notify/route";
import { startBillingCheckout } from "../app/dashboard/billing/actions";
import BillingPage from "../app/dashboard/billing/page";
import { hasBillingAccess, isBillingEnabled } from "../lib/billing-access";

const disabledValues = [undefined, "off", "", "false", "true", "ON", "on "];
beforeEach(() => {
  state.dbCalls = 0;
  vi.stubEnv("PAYFAST_MERCHANT_ID", "synthetic-merchant");
  vi.stubEnv("PAYFAST_MERCHANT_KEY", "synthetic-key");
  vi.stubEnv("PAYFAST_PASSPHRASE", "synthetic-passphrase");
  vi.stubEnv("PAYFAST_PLAN_STARTER_AMOUNT", "199");
  vi.stubEnv("PAYFAST_PLAN_PRO_AMOUNT", "399");
  vi.stubEnv("KEY_FEATURE_TRIAL_LOCK", "on");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No PayFast/network call is permitted"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe.each(disabledValues)("billing disabled with flag %s", (flag) => {
  it("rejects checkout and webhook before body parsing, any DB access or network work", async () => {
    vi.stubEnv("BILLING_ENFORCEMENT", flag);
    expect(isBillingEnabled()).toBe(false);
    const request = new Request("http://localhost/api/payfast/notify", { method: "POST", body: "payment_status=COMPLETE&custom_str1=synthetic-business&custom_str2=starter&amount_gross=199.00" });
    const readBody = vi.spyOn(request, "text").mockRejectedValue(new Error("Body must not be read"));
    for (const response of [await checkout(new Request("http://localhost/api/payfast/checkout?plan=starter")), await notify(request)]) {
      expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe("Billing is disabled");
    }
    expect(readBody).not.toHaveBeenCalled(); expect(state.dbCalls).toBe(0); expect(fetch).not.toHaveBeenCalled();
  });

  it("hides all checkout controls even with configured prices/credentials and blocks the server action", async () => {
    vi.stubEnv("BILLING_ENFORCEMENT", flag);
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, await BillingPage({ searchParams: Promise.resolve({}) })));
    expect(html).toContain("Billing is disabled"); expect(html).not.toContain("<form");
    for (const text of ["Start Starter", "Start Pro", "/api/payfast/checkout", "Access paused"]) expect(html).not.toContain(text);
    await expect(startBillingCheckout("starter")).rejects.toMatchObject({ digest: "NEXT_REDIRECT;replace;/dashboard/billing;307;" });
    expect(state.dbCalls).toBe(0); expect(fetch).not.toHaveBeenCalled();
  });

  it("permits every existing subscription state despite expired trial/period dates", () => {
    vi.stubEnv("BILLING_ENFORCEMENT", flag);
    for (const status of ["trialing", "active", "past_due", "cancelled", "expired"]) {
      expect(hasBillingAccess({ subscription_status: status, current_period_end: "2000-01-01", trial_ends_at: "2000-01-01", created_at: "2000-01-01" } as Business)).toBe(true);
    }
  });
});

it("retains existing access rules only when explicitly enabled", () => {
  vi.stubEnv("BILLING_ENFORCEMENT", "on"); expect(isBillingEnabled()).toBe(true);
  expect(hasBillingAccess({ subscription_status: "cancelled", current_period_end: null, trial_ends_at: null, created_at: "2000-01-01" } as Business)).toBe(false);
});
