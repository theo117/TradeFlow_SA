import { notFound } from "next/navigation";
import { InvoiceDetailActions } from "@/components/dashboard/invoice-detail-actions";
import { InvoiceDocument } from "@/components/dashboard/invoice-document";
import {
  buildWhatsappInvoiceReminderUrl,
  buildWhatsappInvoiceUrl,
  getInvoiceWhatsappRecipient,
  getInvoicePdfUrl,
  getInvoicePublicUrl
} from "@/lib/invoices";
import { buildInvoiceEmailUrl, buildInvoiceReminderEmailUrl } from "@/lib/sharing";
import { getInvoiceById } from "@/lib/queries";

export default async function InvoiceDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);

  if (!invoice || !invoice.business || !invoice.customer) {
    notFound();
  }

  const pdfHref = `/api/invoices/${invoice.id}/pdf`;
  const publicUrl = await getInvoicePublicUrl(
    invoice.id,
    invoice.business.id,
    invoice.business.owner_id
  );
  const publicPdfUrl = await getInvoicePdfUrl(
    invoice.id,
    invoice.business.id,
    invoice.business.owner_id
  );
  const emailHref = invoice.customer.email
    ? buildInvoiceEmailUrl({
        email: invoice.customer.email,
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoice_number,
        businessName: invoice.business.name,
        total: Number(invoice.total),
        invoiceUrl: publicUrl,
        pdfUrl: publicPdfUrl
      })
    : null;
  const whatsappRecipient = getInvoiceWhatsappRecipient(invoice.customer);
  const whatsappHref = whatsappRecipient
    ? buildWhatsappInvoiceUrl({
        phone: whatsappRecipient,
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoice_number,
        businessName: invoice.business.name,
        total: Number(invoice.total),
        invoiceUrl: publicUrl
      })
    : null;
  const reminderEmailHref = invoice.customer.email
    ? buildInvoiceReminderEmailUrl({
        email: invoice.customer.email,
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoice_number,
        businessName: invoice.business.name,
        total: Number(invoice.total),
        invoiceUrl: publicUrl,
        pdfUrl: publicPdfUrl
      })
    : null;
  const reminderWhatsappHref = whatsappRecipient
    ? buildWhatsappInvoiceReminderUrl({
        phone: whatsappRecipient,
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoice_number,
        businessName: invoice.business.name,
        total: Number(invoice.total),
        invoiceUrl: publicUrl
      })
    : null;

  return (
    <InvoiceDocument
      invoice={invoice}
      business={invoice.business}
      customer={invoice.customer}
      actions={
        <InvoiceDetailActions
          invoiceId={invoice.id}
          status={invoice.status}
          pdfHref={pdfHref}
          emailHref={emailHref}
          whatsappHref={whatsappHref}
          reminderEmailHref={reminderEmailHref}
          reminderWhatsappHref={reminderWhatsappHref}
        />
      }
    />
  );
}
