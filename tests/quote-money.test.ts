import { describe, expect, it } from "vitest";
import { quoteItemSchema } from "../lib/validations";
import { calculateQuoteAmounts, calculateQuoteTotal } from "../lib/workflows";
import { MAX_QUOTE_QUANTITY, quoteMoneyToCents } from "../lib/quote-money";

const serviceId = "00000000-0000-0000-0000-000000000001";

describe("authoritative quote money", () => {
  it("derives exact two-decimal amounts from catalogue prices", () => {
    expect(calculateQuoteAmounts([{ service_id: serviceId, quantity: 2 }], [{ id: serviceId, price: "100.00" }]))
      .toEqual({ total: "200.00", items: [{ service_id: serviceId, quantity: 2, price: "100.00", subtotal: "200.00" }] });
    expect(calculateQuoteAmounts([{ service_id: serviceId, quantity: 3 }], [{ id: serviceId, price: "0.10" }]).total).toBe("0.30");
    expect(calculateQuoteTotal([{ subtotal: 0.1 }, { subtotal: 0.2 }])).toBe(0.3);
  });

  it("retains free services and the existing database precision boundary", () => {
    expect(calculateQuoteAmounts([{ service_id: serviceId, quantity: MAX_QUOTE_QUANTITY }], [{ id: serviceId, price: "0.00" }]).total).toBe("0.00");
    expect(calculateQuoteAmounts([{ service_id: serviceId, quantity: 1 }], [{ id: serviceId, price: "9999999999.99" }]).total).toBe("9999999999.99");
  });

  it("rejects fractional cents, invalid money, and unsafe monetary range", () => {
    for (const value of [0.005, 1.005, NaN, Infinity, -1, 10000000000, "0.005", "NaN"]) {
      expect(() => quoteMoneyToCents(value)).toThrow();
    }
    expect(() => calculateQuoteTotal([{ subtotal: 0.005 }, { subtotal: 0.005 }])).toThrow();
  });

  it("rejects invalid quantities before monetary calculation", () => {
    for (const quantity of [0, -1, 1.5, NaN, Infinity, -Infinity, MAX_QUOTE_QUANTITY + 1]) {
      expect(quoteItemSchema.safeParse({ service_id: serviceId, quantity }).success).toBe(false);
      expect(() => calculateQuoteAmounts([{ service_id: serviceId, quantity }], [{ id: serviceId, price: "100.00" }])).toThrow();
    }
  });

  it("rejects line and aggregate overflow before persistence", () => {
    expect(() => calculateQuoteAmounts([{ service_id: serviceId, quantity: 2 }], [{ id: serviceId, price: "9999999999.99" }])).toThrow();
    expect(() => calculateQuoteAmounts([{ service_id: serviceId, quantity: 1 }, { service_id: serviceId, quantity: 1 }], [{ id: serviceId, price: "5000000000.00" }])).toThrow();
  });

  it("accepts the minimal payload but rejects excessive precision in legacy fields", () => {
    expect(quoteItemSchema.safeParse({ service_id: serviceId, quantity: 1 }).success).toBe(true);
    expect(quoteItemSchema.safeParse({ service_id: serviceId, quantity: 1, price: 0.005 }).success).toBe(false);
    expect(quoteItemSchema.safeParse({ service_id: serviceId, quantity: 1, subtotal: 0.005 }).success).toBe(false);
  });
});
