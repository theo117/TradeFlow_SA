import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/dashboard/invoice-document";
import { WhatsAppShareButton } from "@/components/dashboard/whatsapp-share-button";
import { buttonVariants } from "@/components/ui/button";
import { validatePublicAccessToken } from "@/lib/public-access";
import {
  buildWhatsappInvoiceUrl,
  getInvoiceWhatsappRecipient
} from "@/lib/invoices";
import { getPublicInvoiceById } from "@/lib/queries";
import { getBaseUrl } from "@/lib/utils";

export default async function PublicInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; expires?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!(await validatePublicAccessToken({ type: "invoice", id, token }))) {
    notFound();
  }

  const invoice = await getPublicInvoiceById(id);

  if (!invoice || !invoice.business || !invoice.customer) {
    notFound();
  }

  const encodedToken = encodeURIComponent(token ?? "");
  const pdfHref = `/api/invoices/${invoice.id}/pdf?token=${encodedToken}`;
  const whatsappRecipient = getInvoiceWhatsappRecipient(invoice.customer);
  const publicUrl = `${getBaseUrl()}/invoice/${invoice.id}?token=${encodedToken}`;
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f0ff_0%,#f8fafc_32%,#f8fafc_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 px-6 py-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Public invoice
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">
              {invoice.invoice_number}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={pdfHref} className={buttonVariants({})}>
              Download PDF
            </Link>
            <WhatsAppShareButton href={whatsappHref} />
          </div>
        </div>

        <InvoiceDocument
          invoice={invoice}
          business={invoice.business}
          customer={invoice.customer}
        />
      </div>
    </main>
  );
}
