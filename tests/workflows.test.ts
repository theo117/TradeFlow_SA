import { describe, expect, it } from "vitest";
import {
  buildInvoiceItemsFromQuoteItems,
  calculateQuoteTotal,
  normalizeRedirectTarget
} from "../lib/workflows";

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
