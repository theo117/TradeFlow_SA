import { notFound } from "next/navigation";
import { QuoteDetailActions } from "@/components/dashboard/quote-detail-actions";
import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getDefaultInvoiceDueDate } from "@/lib/invoices";
import { getInvoiceByQuoteId, getQuoteById } from "@/lib/queries";
import { currency, formatDate } from "@/lib/utils";

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

  if (!quote) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <QuoteDetailActions
          quoteId={quote.id}
          status={quote.status}
          defaultDueDate={getDefaultInvoiceDueDate()}
          existingInvoice={existingInvoice}
        />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Topbar
            title={`Quote ${quote.id.slice(0, 8).toUpperCase()}`}
            subtitle={`Created on ${formatDate(quote.created_at)} for ${quote.customer?.name ?? "Unknown customer"}.`}
          />
          <Badge variant={quote.status}>{quote.status}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="space-y-4 border-slate-200/80 bg-white/95">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Quote details
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Quote items</h2>
            <p className="text-sm text-slate-500">Detailed services included in this quote.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Service</th>
                  <th className="px-6 py-3 font-medium">Qty</th>
                  <th className="px-6 py-3 font-medium">Price</th>
                  <th className="px-6 py-3 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {quote.items?.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <div className="font-medium text-ink">
                        {item.service?.name ?? "Unknown service"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.service?.description ?? ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{item.quantity}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {currency(Number(item.price))}
                    </td>
                    <td className="px-6 py-4 font-medium text-ink">
                      {currency(Number(item.subtotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="space-y-4 border-slate-200/80 bg-white/95">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Customer profile
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Customer</h2>
            <p className="text-sm text-slate-500">Linked customer information for this quote.</p>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-slate-500">Name</p>
              <p className="font-medium text-ink">{quote.customer?.name ?? "Unknown"}</p>
            </div>
            <div>
              <p className="text-slate-500">Email</p>
              <p className="font-medium text-ink">{quote.customer?.email ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="font-medium text-ink">{quote.customer?.phone ?? "Not provided"}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-ink px-5 py-4 text-white">
            <p className="text-sm text-slate-300">Total</p>
            <p className="text-3xl font-semibold">{currency(Number(quote.total))}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
