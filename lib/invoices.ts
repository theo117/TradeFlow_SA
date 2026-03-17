import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { getOrCreatePublicShareUrl } from "@/lib/public-access";
import { currency } from "@/lib/utils";
import { normalizeWhatsappPhone, resolveCustomerWhatsappPhone } from "@/lib/whatsapp";

const DEFAULT_INVOICE_DUE_DAYS = 7;

export async function syncOverdueInvoices(businessId?: string | null) {
  await db
    .update(invoices)
    .set({ status: "overdue" })
    .where(
      businessId
        ? and(
            eq(invoices.businessId, businessId),
            ne(invoices.status, "paid"),
            sql`${invoices.dueDate} < current_date`
          )
        : and(ne(invoices.status, "paid"), sql`${invoices.dueDate} < current_date`)
    );
}

export async function syncOverdueInvoicesAsAdmin(businessId?: string | null) {
  await syncOverdueInvoices(businessId);
}

export function getDefaultInvoiceDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DEFAULT_INVOICE_DUE_DAYS);
  return dueDate.toISOString().slice(0, 10);
}

export function getInvoicePublicUrl(
  invoiceId: string,
  businessId: string,
  createdByUserId?: string | null
) {
  return getOrCreatePublicShareUrl({
    type: "invoice",
    businessId,
    invoiceId,
    createdByUserId,
    path: `/invoice/${invoiceId}`
  });
}

export function getInvoicePdfUrl(
  invoiceId: string,
  businessId: string,
  createdByUserId?: string | null
) {
  return getOrCreatePublicShareUrl({
    type: "invoice-pdf",
    businessId,
    invoiceId,
    createdByUserId,
    path: `/api/invoices/${invoiceId}/pdf`
  });
}

export function buildWhatsappInvoiceUrl({
  phone,
  customerName,
  invoiceNumber,
  businessName,
  total,
  invoiceUrl
}: {
  phone: string;
  customerName: string;
  invoiceNumber: string;
  businessName: string;
  total: number;
  invoiceUrl: string;
}) {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const message = [
    `Hello ${customerName},`,
    "",
    `Your invoice #${invoiceNumber} from ${businessName} is ready.`,
    "",
    `Amount due: ${currency(total)}`,
    "",
    "View your invoice here:",
    invoiceUrl,
    "",
    "Thank you."
  ].join("\n");

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsappInvoiceReminderUrl({
  phone,
  customerName,
  invoiceNumber,
  businessName,
  total,
  invoiceUrl
}: {
  phone: string;
  customerName: string;
  invoiceNumber: string;
  businessName: string;
  total: number;
  invoiceUrl: string;
}) {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const message = [
    `Hello ${customerName},`,
    "",
    `This is a reminder about invoice #${invoiceNumber} from ${businessName}.`,
    `Amount due: ${currency(total)}`,
    "",
    "View your invoice here:",
    invoiceUrl,
    "",
    "Thank you."
  ].join("\n");

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function getInvoiceWhatsappRecipient(customer: {
  phone?: string | null;
  whatsapp_phone?: string | null;
}) {
  return resolveCustomerWhatsappPhone(customer);
}
