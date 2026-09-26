import { MAX_QUOTE_CENTS, quoteCentsToDecimal, quoteMoneyToCents, sumQuoteCents } from "@/lib/quote-money";
import { quoteQuantitySchema } from "@/lib/validations";

export function normalizeRedirectTarget(value: FormDataEntryValue | string | null) {
  const fallback = "/dashboard";

  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  return value.startsWith("/") ? value : fallback;
}

export function calculateQuoteTotal(items: Array<{ subtotal: number }>) {
  return sumQuoteCents(items.map((item) => quoteMoneyToCents(item.subtotal))) / 100;
}

export function calculateQuoteAmounts(
  items: Array<{ service_id: string; quantity: number }>,
  catalogue: Array<{ id: string; price: string }>
) {
  const prices = new Map(catalogue.map((service) => [service.id, service.price]));
  const lines = items.map((item) => {
    const quantity = quoteQuantitySchema.parse(item.quantity);
    const price = prices.get(item.service_id);
    if (price === undefined) throw new Error("One or more services are invalid.");
    const priceCents = quoteMoneyToCents(price);
    // Check before multiplication: even extreme quantities cannot overflow integer cents.
    if (priceCents > 0 && quantity > Math.floor(MAX_QUOTE_CENTS / priceCents)) {
      throw new Error("Quote line exceeds the supported monetary limit.");
    }
    const subtotalCents = priceCents * quantity;
    return { service_id: item.service_id, quantity, priceCents, subtotalCents };
  });
  const totalCents = sumQuoteCents(lines.map((line) => line.subtotalCents));
  return {
    total: quoteCentsToDecimal(totalCents),
    items: lines.map((line) => ({
      service_id: line.service_id,
      quantity: line.quantity,
      price: quoteCentsToDecimal(line.priceCents),
      subtotal: quoteCentsToDecimal(line.subtotalCents)
    }))
  };
}

export function buildInvoiceItemsFromQuoteItems(
  items: Array<{
    serviceId: string;
    quantity: number;
    price: number;
    subtotal: number;
    service?: {
      name?: string | null;
      description?: string | null;
    } | null;
  }>
) {
  return items.map((item) => ({
    serviceId: item.serviceId,
    description: item.service?.name ?? item.service?.description ?? "Service",
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal
  }));
}
