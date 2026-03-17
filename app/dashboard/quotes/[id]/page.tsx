import { notFound } from "next/navigation";
import { QuoteDetailActions } from "@/components/dashboard/quote-detail-actions";
import { QuoteDocument } from "@/components/dashboard/quote-document";
import { getDefaultInvoiceDueDate } from "@/lib/invoices";
import { getQuotePdfUrl, getQuotePublicUrl } from "@/lib/quotes";
import { getInvoiceByQuoteId, getQuoteById } from "@/lib/queries";
import { buildQuoteEmailUrl } from "@/lib/sharing";

export default async function QuoteDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, existingInvoice] = await Promise.all([
    getQuoteById(id),
    getInvoiceByQuoteId(id)
  ]);

  if (!quote || !quote.business || !quote.customer) {
    notFound();
  }

  const publicUrl = getQuotePublicUrl(quote.id);
  const pdfUrl = getQuotePdfUrl(quote.id);
  const emailHref = quote.customer.email
    ? buildQuoteEmailUrl({
        email: quote.customer.email,
        customerName: quote.customer.name,
        quoteReference: quote.id.slice(0, 8).toUpperCase(),
        businessName: quote.business.name,
        total: Number(quote.total),
        quoteUrl: publicUrl,
        pdfUrl
      })
    : null;

  return (
    <QuoteDocument
      quote={quote}
      business={quote.business}
      customer={quote.customer}
      actions={
        <QuoteDetailActions
          quoteId={quote.id}
          status={quote.status}
          defaultDueDate={getDefaultInvoiceDueDate()}
          emailHref={emailHref}
          publicHref={publicUrl}
          existingInvoice={existingInvoice}
        />
      }
    />
  );
}
