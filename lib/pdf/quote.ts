import type { Business, Customer, Quote, QuoteItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { generateDocumentPdf } from "./document";

type QuotePdfPayload = {
  business: Pick<
    Business,
    | "name"
    | "address"
    | "email"
    | "phone"
    | "vat_number"
    | "registration_number"
    | "bank_name"
    | "bank_account_name"
    | "bank_account_number"
    | "bank_branch_code"
    | "payment_instructions"
    | "logo_url"
  >;
  customer: Pick<Customer, "name" | "email" | "phone" | "address">;
  quote: Pick<Quote, "id" | "created_at" | "status" | "total">;
  items: Array<
    Pick<QuoteItem, "quantity" | "price" | "subtotal"> & {
      description: string;
    }
  >;
};

export async function generateQuotePdf(payload: QuotePdfPayload) {
  return generateDocumentPdf({
    ...payload,
    kind: "Quote",
    metadata: [
      ["Quote reference", payload.quote.id.slice(0, 8).toUpperCase()],
      ["Quote date", formatDate(payload.quote.created_at)],
      ["Status", payload.quote.status]
    ],
    total: payload.quote.total,
    notes: payload.business.payment_instructions ??
      "Thank you for considering this quote. Please contact us if you would like any changes."
  });
}
