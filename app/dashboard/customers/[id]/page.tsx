import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkflowHeader } from "@/components/dashboard/workflow-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCustomerDetail } from "@/lib/queries";
import { currency, formatDate } from "@/lib/utils";

export default async function CustomerDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);

  if (!detail) {
    notFound();
  }

  const { customer, quotes, invoices, activity } = detail;

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title={customer.name}
        subtitle="Customer record, recent documents, and activity history."
        backHref="/dashboard/customers"
        backLabel="Back to customers"
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="space-y-4 border-slate-200/80 bg-white/95">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Contact details
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{customer.name}</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-slate-500">Email</p>
              <p className="font-medium text-ink">{customer.email ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="font-medium text-ink">{customer.phone ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-slate-500">Address</p>
              <p className="font-medium text-ink">{customer.address ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-slate-500">Added</p>
              <p className="font-medium text-ink">{formatDate(customer.created_at)}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Quotes" value={quotes.length} />
            <Stat label="Invoices" value={invoices.length} />
            <Stat
              label="Lifetime value"
              value={currency(
                invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
              )}
            />
          </div>

          <div className="flex gap-2">
            <Link href={`/dashboard/customers/${customer.id}/edit`} className={buttonVariants({})}>
              Edit customer
            </Link>
            <Link href="/dashboard/quotes/new" className={buttonVariants({ variant: "secondary" })}>
              Create quote
            </Link>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200/80 bg-white/95">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Recent documents
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Quotes and invoices</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-500">Quotes</p>
                {quotes.length === 0 ? (
                  <p className="text-sm text-slate-500">No quotes yet.</p>
                ) : (
                  quotes.map((quote) => (
                    <Link
                      key={quote.id}
                      href={`/dashboard/quotes/${quote.id}`}
                      className="block rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">
                            Quote {quote.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatDate(quote.created_at)}
                          </p>
                        </div>
                        <Badge variant={quote.status}>{quote.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {currency(Number(quote.total))}
                      </p>
                    </Link>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-500">Invoices</p>
                {invoices.length === 0 ? (
                  <p className="text-sm text-slate-500">No invoices yet.</p>
                ) : (
                  invoices.map((invoice) => (
                    <Link
                      key={invoice.id}
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="block rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{invoice.invoice_number}</p>
                          <p className="text-sm text-slate-500">
                            {formatDate(invoice.created_at)}
                          </p>
                        </div>
                        <Badge variant={invoice.status}>{invoice.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {currency(Number(invoice.total))}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="border-slate-200/80 bg-white/95">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Activity
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Customer timeline</h2>
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-slate-500">
                Activity will appear here as you create quotes, send reminders, and update invoices.
              </p>
            ) : (
              <div className="space-y-4">
                {activity.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{event.description}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(event.created_at)}
                        </p>
                      </div>
                      {event.channel ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                          {event.channel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}
