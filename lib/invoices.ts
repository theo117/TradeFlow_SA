import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currency, getBaseUrl } from "@/lib/utils";

const DEFAULT_INVOICE_DUE_DAYS = 7;

export async function syncOverdueInvoices(businessId?: string | null) {
  const supabase = await createClient();
  await supabase.rpc("sync_overdue_invoices", {
    target_business_id: businessId ?? null
  });
}

export async function syncOverdueInvoicesAsAdmin(businessId?: string | null) {
  const supabase = createAdminClient();
  await supabase.rpc("sync_overdue_invoices", {
    target_business_id: businessId ?? null
  });
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
