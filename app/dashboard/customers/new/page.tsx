import Link from "next/link";
import { createCustomer } from "@/app/dashboard/customers/actions";
import { WorkflowHeader } from "@/components/dashboard/workflow-header";
import { Field } from "@/components/forms/field";
import { FormSection } from "@/components/forms/form-section";
import { PendingButton } from "@/components/forms/pending-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default async function NewCustomerPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title="Add customer"
        subtitle="Create a customer record for future quotes."
        backHref="/dashboard/customers"
        backLabel="Back to customers"
      />

      <form action={createCustomer} className="space-y-4">
        {params.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {params.error}
          </div>
        ) : null}
        <FormSection title="Customer details" description="Store core contact information for the business or client.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field htmlFor="name" label="Name">
              <Input id="name" name="name" required />
            </Field>
            <Field htmlFor="email" label="Email">
              <Input id="email" name="email" type="email" />
            </Field>
            <Field htmlFor="phone" label="Phone">
              <Input id="phone" name="phone" />
            </Field>
          </div>
          <Field htmlFor="address" label="Address">
            <Textarea id="address" name="address" />
          </Field>
        </FormSection>

        <div className="flex gap-3">
          <PendingButton pendingLabel="Saving customer...">Save customer</PendingButton>
          <Link href="/dashboard/customers" className={buttonVariants({ variant: "secondary" })}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
