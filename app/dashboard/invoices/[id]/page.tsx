import { notFound } from "next/navigation";
import { InvoiceDetailActions } from "@/components/dashboard/invoice-detail-actions";
import { InvoiceDocument } from "@/components/dashboard/invoice-document";
import {
  buildWhatsappInvoiceUrl,
  getInvoicePdfUrl,
  getInvoicePublicUrl
} from "@/lib/invoices";
import { buildInvoiceEmailUrl } from "@/lib/sharing";
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
  const publicUrl = getInvoicePublicUrl(invoice.id);
  const emailHref = invoice.customer.email
    ? buildInvoiceEmailUrl({
        email: invoice.customer.email,
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoice_number,
        businessName: invoice.business.name,
        total: Number(invoice.total),
        invoiceUrl: publicUrl,
        pdfUrl: getInvoicePdfUrl(invoice.id)
      })
    : null;
  const whatsappHref = invoice.customer.phone
    ? buildWhatsappInvoiceUrl({
        phone: invoice.customer.phone,
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
        />
      }
    />
  );
}
