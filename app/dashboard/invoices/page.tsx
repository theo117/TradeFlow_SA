import Link from "next/link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { InvoicesTable } from "@/components/dashboard/invoices-table";
import { ResourceHeader } from "@/components/dashboard/resource-header";
import { buttonVariants } from "@/components/ui/button";
import { getInvoices } from "@/lib/queries";
import { currency } from "@/lib/utils";

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "paid");

  return (
    <div className="space-y-6">
      <ResourceHeader
        title="Invoices"
        subtitle="Track what is owed, what is overdue, and what has already been paid."
        ctaHref="/dashboard/quotes"
        ctaLabel="Convert quote"
        stats={[
          { label: "Total invoices", value: invoices.length },
          { label: "Unpaid", value: unpaidInvoices.length },
          {
            label: "Outstanding value",
            value: currency(
              unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
            )
          }
        ]}
      />

      <div className="flex justify-end">
        <Link
          href="/api/export/invoices"
          className={buttonVariants({ variant: "secondary" })}
        >
          Export invoices CSV
        </Link>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Convert a quote into an invoice to start billing your customers."
          ctaHref="/dashboard/quotes"
          ctaLabel="Open quotes"
        />
      ) : (
        <InvoicesTable invoices={invoices} />
      )}
    </div>
  );
}
