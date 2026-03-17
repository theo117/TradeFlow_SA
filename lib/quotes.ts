import { currency } from "@/lib/utils";
import { getOrCreatePublicShareUrl } from "@/lib/public-access";
import { normalizeWhatsappPhone, resolveCustomerWhatsappPhone } from "@/lib/whatsapp";

export function getQuotePublicUrl(
  quoteId: string,
  businessId: string,
  createdByUserId?: string | null
) {
  return getOrCreatePublicShareUrl({
    type: "quote",
    businessId,
    quoteId,
    createdByUserId,
    path: `/quote/${quoteId}`
  });
}

export function getQuotePdfUrl(
  quoteId: string,
  businessId: string,
  createdByUserId?: string | null
) {
  return getOrCreatePublicShareUrl({
    type: "quote-pdf",
    businessId,
    quoteId,
    createdByUserId,
    path: `/api/quotes/${quoteId}/pdf`
  });
}

export function buildWhatsappQuoteUrl({
  phone,
  customerName,
  quoteReference,
  businessName,
  total,
  quoteUrl
}: {
  phone: string;
  customerName: string;
  quoteReference: string;
  businessName: string;
  total: number;
  quoteUrl: string;
}) {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const message = [
    `Hello ${customerName},`,
    "",
    `Please find your quote ${quoteReference} from ${businessName}.`,
    `Quoted total: ${currency(total)}`,
    "",
    "View your quote here:",
    quoteUrl,
    "",
    "Thank you."
  ].join("\n");

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function getQuoteWhatsappRecipient(customer: {
  phone?: string | null;
  whatsapp_phone?: string | null;
}) {
  return resolveCustomerWhatsappPhone(customer);
}
