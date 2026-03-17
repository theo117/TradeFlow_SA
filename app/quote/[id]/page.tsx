import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptQuote } from "@/app/quote/actions";
import { WhatsAppShareButton } from "@/components/dashboard/whatsapp-share-button";
import { PendingButton } from "@/components/forms/pending-button";
import { QuoteDocument } from "@/components/dashboard/quote-document";
import { buttonVariants } from "@/components/ui/button";
import {
  buildWhatsappQuoteUrl,
  getQuotePdfUrl,
  getQuotePublicUrl,
  getQuoteWhatsappRecipient
} from "@/lib/quotes";
import { validatePublicAccessToken } from "@/lib/public-access";
import { getPublicQuoteById } from "@/lib/queries";

export default async function PublicQuotePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    success?: string;
    error?: string;
    token?: string;
  }>;
}) {
  const { id } = await params;
  const { success, error, token } = await searchParams;

  if (!(await validatePublicAccessToken({ type: "quote", id, token }))) {
    notFound();
  }

  const quote = await getPublicQuoteById(id);

  if (!quote || !quote.business || !quote.customer) {
    notFound();
  }

  const whatsappRecipient = getQuoteWhatsappRecipient(quote.customer);
  const publicUrl = await getQuotePublicUrl(quote.id, quote.business.id);
  const pdfUrl = await getQuotePdfUrl(quote.id, quote.business.id);
  const whatsappHref = whatsappRecipient
    ? buildWhatsappQuoteUrl({
        phone: whatsappRecipient,
        customerName: quote.customer.name,
        quoteReference: quote.id.slice(0, 8).toUpperCase(),
        businessName: quote.business.name,
        total: Number(quote.total),
        quoteUrl: publicUrl
      })
    : null;
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f0ff_0%,#f8fafc_32%,#f8fafc_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 px-6 py-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Public quote
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">
              Quote {quote.id.slice(0, 8).toUpperCase()}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={pdfUrl}
              className={buttonVariants({ variant: "secondary" })}
            >
              Download PDF
            </Link>
            <WhatsAppShareButton href={whatsappHref} />
            {quote.status === "accepted" ? (
              <span
                className={buttonVariants({
                  className:
                    "pointer-events-none bg-emerald-600 text-white hover:bg-emerald-600"
                })}
              >
                Accepted
              </span>
            ) : quote.status === "sent" ? (
              <form action={acceptQuote}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="token" value={token ?? ""} />
                <PendingButton pendingLabel="Accepting...">Accept quote</PendingButton>
              </form>
            ) : (
              <span
                className={buttonVariants({
                  variant: "secondary",
                  className: "pointer-events-none opacity-70"
                })}
              >
                Not ready to accept
              </span>
            )}
          </div>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <QuoteDocument
          quote={quote}
          business={quote.business}
          customer={quote.customer}
        />
      </div>
    </main>
  );
}
