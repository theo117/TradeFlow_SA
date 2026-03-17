export function normalizeRedirectTarget(value: FormDataEntryValue | string | null) {
  const fallback = "/dashboard";

  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  return value.startsWith("/") ? value : fallback;
}

export function calculateQuoteTotal(items: Array<{ subtotal: number }>) {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
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
