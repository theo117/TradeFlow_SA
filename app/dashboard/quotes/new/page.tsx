import { redirect } from "next/navigation";
import { createQuote } from "@/app/dashboard/quotes/actions";
import { WorkflowHeader } from "@/components/dashboard/workflow-header";
import { QuoteBuilderForm } from "@/components/quotes/quote-builder-form";
import { getCustomers, getServices } from "@/lib/queries";

export default async function NewQuotePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const [customers, services] = await Promise.all([getCustomers(), getServices()]);

  if (customers.length === 0) {
    redirect("/dashboard/customers/new");
  }

  if (services.length === 0) {
    redirect("/dashboard/services/new");
  }

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title="Create quote"
        subtitle="Build a quote using saved customers and services."
        backHref="/dashboard/quotes"
        backLabel="Back to quotes"
      />

      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {params.error}
        </div>
      ) : null}

      <div>
        <QuoteBuilderForm customers={customers} services={services} action={createQuote} />
      </div>
    </div>
  );
}
