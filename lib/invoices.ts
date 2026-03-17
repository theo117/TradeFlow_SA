import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { currency, getBaseUrl } from "@/lib/utils";

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

export function getInvoicePublicUrl(invoiceId: string) {
  return `${getBaseUrl()}/invoice/${invoiceId}`;
}

export function getInvoicePdfUrl(invoiceId: string) {
  return `${getBaseUrl()}/api/invoices/${invoiceId}/pdf`;
}

export function normalizeWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("27")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `27${digits.slice(1)}`;
  }

  return digits;
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
