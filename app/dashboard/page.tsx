import Link from "next/link";
import {
  AlertCircle,
  FileText,
  ReceiptText,
  TrendingUp,
  Users
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RecentQuotesTable } from "@/components/dashboard/recent-quotes-table";
import { Topbar } from "@/components/dashboard/topbar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/queries";
import { currency } from "@/lib/utils";

export default async function DashboardPage() {
  const {
    customerCount,
    quoteCount,
    unpaidInvoiceCount,
    overdueInvoiceCount,
    totalRevenue,
    recentQuotes
  } = await getDashboardMetrics();

  return (
    <div className="space-y-6">
      <Topbar
        title="Dashboard"
        subtitle="Track customers, quotes, invoices, and revenue from one dashboard."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total customers"
          value={customerCount}
          detail="Active contacts and businesses ready for new quotes and invoices."
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label="Total quotes"
          value={quoteCount}
          detail="Every quote created in your workspace across draft, sent, and accepted stages."
          icon={<FileText className="h-5 w-5" />}
          tone="sky"
        />
        <MetricCard
          label="Unpaid invoices"
          value={unpaidInvoiceCount}
          detail="Draft, sent, and overdue invoices still waiting for payment."
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <MetricCard
          label="Total revenue"
          value={currency(totalRevenue)}
          detail="Revenue collected from invoices already marked as paid."
          icon={<TrendingUp className="h-5 w-5" />}
          tone="sky"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <RecentQuotesTable quotes={recentQuotes} />

        <div className="space-y-6">
          <Card className="overflow-hidden border-slate-200/80 bg-[linear-gradient(135deg,#0b1020_0%,#18243f_55%,#1b3558_100%)] p-0 text-white">
            <div className="space-y-5 p-6">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                Quick action
              </div>
              <div>
                <p className="text-2xl font-semibold">Create a new invoice</p>
                <p className="mt-2 max-w-md text-sm text-slate-300">
                  Convert a quote into an invoice, then send it by PDF or WhatsApp.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-slate-400">Overdue</p>
                  <p className="mt-1 text-xl font-semibold">{overdueInvoiceCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-slate-400">Collected</p>
                  <p className="mt-1 text-xl font-semibold">{currency(totalRevenue)}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/5 px-6 py-4">
              <Link
                href="/dashboard/quotes"
                className={buttonVariants({
                  className:
                    "border border-white/10 bg-white text-slate-950 hover:bg-slate-100"
                })}
              >
                Create Invoice
              </Link>
            </div>
          </Card>

          <Card className="border-slate-200/80 bg-white/95 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Workflow summary
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Workspace snapshot</h2>
              <p className="mt-1 text-sm text-slate-500">
                Quotes, billing, and collections in one clean workflow.
              </p>
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm text-slate-500">Quote acceptance</p>
                <p className="mt-2 text-3xl font-semibold text-ink">
                  {quoteCount === 0
                    ? "0%"
                    : `${Math.round(
                        (recentQuotes.filter((quote) => quote.status === "accepted").length /
                          Math.max(recentQuotes.length, 1)) *
                          100
                      )}%`}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm text-slate-500">Average quote value</p>
                <p className="mt-2 text-3xl font-semibold text-ink">
                  {quoteCount === 0
                    ? currency(0)
                    : currency(
                        recentQuotes.reduce((sum, quote) => sum + Number(quote.total), 0) /
                          Math.max(recentQuotes.length, 1)
                      )}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm text-slate-500">Invoices requiring action</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-ink">
                  {unpaidInvoiceCount}
                  {overdueInvoiceCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {overdueInvoiceCount} overdue
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Use the sidebar to move from quotes into invoices without breaking the workflow.
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
