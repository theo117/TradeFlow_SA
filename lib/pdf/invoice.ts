import type { Business, Customer, Invoice, InvoiceItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { generateDocumentPdf } from "./document";

type InvoicePdfPayload = {
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
  invoice: Pick<Invoice, "invoice_number" | "created_at" | "due_date" | "total" | "status">;
  items: Pick<InvoiceItem, "description" | "quantity" | "price" | "subtotal">[];
};

export async function generateInvoicePdf(payload: InvoicePdfPayload) {
  return generateDocumentPdf({
    ...payload,
    kind: "Invoice",
    void: payload.invoice.status === "void",
    metadata: [
      ["Invoice number", payload.invoice.invoice_number],
      ["Invoice date", formatDate(payload.invoice.created_at)],
      ["Due date", formatDate(payload.invoice.due_date)]
    ],
    total: payload.invoice.total,
    notes: payload.business.payment_instructions ??
      "Please make payment by the due date and use the invoice number as your reference."
  });
}
