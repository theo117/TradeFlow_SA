import { CalendarClock } from "lucide-react";
import { createRecurringInvoiceTemplate } from "@/app/dashboard/recurring/actions";
import { RecurringInvoicesTable } from "@/components/dashboard/recurring-invoices-table";
import { ResourceHeader } from "@/components/dashboard/resource-header";
import { Field } from "@/components/forms/field";
import { PendingButton } from "@/components/forms/pending-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCustomers, getRecurringInvoiceTemplates } from "@/lib/queries";
import { currency, toDateInputValue } from "@/lib/utils";

export default async function RecurringInvoicesPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [customers, templates] = await Promise.all([
    getCustomers(),
    getRecurringInvoiceTemplates()
  ]);
  const activeTemplates = templates.filter((template) => template.status === "active");
  const monthlyValue = activeTemplates.reduce((sum, template) => {
    const divisor =
      template.frequency === "monthly"
        ? 1
        : template.frequency === "quarterly"
          ? 3
          : 12;
    return sum + Number(template.total) / divisor;
  }, 0);

  return (
    <div className="space-y-6">
      <ResourceHeader
        title="Recurring invoices"
        subtitle="Manage retainers, maintenance contracts, and repeat billing without recreating invoices from scratch."
        ctaHref="/dashboard/customers/new"
        ctaLabel="Add customer"
        stats={[
          { label: "Templates", value: templates.length },
          { label: "Active", value: activeTemplates.length },
          { label: "Monthly run-rate", value: currency(monthlyValue) }
        ]}
      />

      {params.success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {params.success}
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {params.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-slate-200/80 bg-white/95 p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-brand-700">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                New template
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Schedule repeat billing
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Use this for retainers, subscriptions, and recurring service work.
              </p>
            </div>
          </div>

          <form action={createRecurringInvoiceTemplate} className="space-y-4">
            <Field htmlFor="customerId" label="Customer">
              <Select id="customerId" name="customerId" required>
                <option value="">Choose customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="name" label="Template name">
              <Input
                id="name"
                name="name"
                placeholder="Monthly maintenance retainer"
                required
              />
            </Field>
            <Field htmlFor="description" label="Invoice line description">
              <Textarea
                id="description"
                name="description"
                placeholder="Monthly service and support retainer"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="frequency" label="Frequency">
                <Select id="frequency" name="frequency" defaultValue="monthly" required>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </Select>
              </Field>
              <Field htmlFor="total" label="Amount">
                <Input
                  id="total"
                  name="total"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </Field>
              <Field htmlFor="nextInvoiceDate" label="Next invoice date">
                <Input
                  id="nextInvoiceDate"
                  name="nextInvoiceDate"
                  type="date"
                  defaultValue={toDateInputValue(new Date())}
                  required
                />
              </Field>
              <Field htmlFor="paymentTermsDays" label="Payment terms">
                <Input
                  id="paymentTermsDays"
                  name="paymentTermsDays"
                  type="number"
                  min="0"
                  max="90"
                  defaultValue="7"
                  required
                />
              </Field>
            </div>
            <PendingButton pendingLabel="Creating template...">
              Create recurring invoice
            </PendingButton>
          </form>
        </Card>

        <RecurringInvoicesTable templates={templates} />
      </div>
    </div>
  );
}
