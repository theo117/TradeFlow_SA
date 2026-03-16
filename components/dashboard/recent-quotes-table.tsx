import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currency, formatDate } from "@/lib/utils";

type RecentQuote = {
  id: string;
  total: number | string;
  status: "draft" | "sent";
  created_at: string;
  customer?: {
    name?: string | null;
  } | null;
};

export function RecentQuotesTable({ quotes }: { quotes: RecentQuote[] }) {
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Revenue pipeline
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Recent quotes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Track recently created quotes and their current status.
          </p>
        </div>

        <Link
          href="/dashboard/quotes"
          className={buttonVariants({ variant: "secondary" })}
        >
          View all quotes
        </Link>
      </div>

      <div className="hidden md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Customer</th>
              <th className="px-6 py-3 font-medium">Created</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Total</th>
              <th className="px-6 py-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {quotes.map((quote) => (
              <tr key={quote.id} className="transition hover:bg-slate-50/80">
                <td className="px-6 py-4">
                  <div className="font-medium text-ink">
                    {quote.customer?.name ?? "Unknown customer"}
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Quote #{quote.id.slice(0, 8).toUpperCase()}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500">{formatDate(quote.created_at)}</td>
                <td className="px-6 py-4">
                  <Badge variant={quote.status}>{quote.status}</Badge>
                </td>
                <td className="px-6 py-4 font-medium text-ink">
                  {currency(Number(quote.total))}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/dashboard/quotes/${quote.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-ink"
                  >
                    Open
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No quotes yet. Create your first quote to populate this table.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {quotes.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No quotes yet. Create your first quote to populate this table.
          </div>
        ) : (
          quotes.map((quote) => (
            <div key={quote.id} className="space-y-3 px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {quote.customer?.name ?? "Unknown customer"}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Quote #{quote.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <Badge variant={quote.status}>{quote.status}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{formatDate(quote.created_at)}</span>
                <span className="font-medium text-ink">{currency(Number(quote.total))}</span>
              </div>
              <Link
                href={`/dashboard/quotes/${quote.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
              >
                View quote
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
