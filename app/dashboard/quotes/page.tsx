import { QuotesTable } from "@/components/dashboard/quotes-table";
import { ResourceHeader } from "@/components/dashboard/resource-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getQuotes } from "@/lib/queries";
import { currency } from "@/lib/utils";

export default async function QuotesPage() {
  const quotes = await getQuotes();

  return (
    <div className="space-y-6">
      <ResourceHeader
        title="Quotes"
        subtitle="Create, track, and review customer quotes."
        ctaHref="/dashboard/quotes/new"
        ctaLabel="Create quote"
        stats={[
          { label: "Total quotes", value: quotes.length },
          {
            label: "Sent quotes",
            value: quotes.filter((quote) => quote.status === "sent").length
          },
          {
            label: "Total value",
            value: currency(
              quotes.reduce((sum, quote) => sum + Number(quote.total), 0)
            )
          }
        ]}
      />

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="Create your first quote using saved customer and service data."
          ctaHref="/dashboard/quotes/new"
          ctaLabel="Create quote"
        />
      ) : (
        <QuotesTable quotes={quotes} />
      )}
    </div>
  );
}
