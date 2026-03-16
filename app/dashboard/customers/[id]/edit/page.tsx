import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCustomer } from "@/app/dashboard/customers/actions";
import { WorkflowHeader } from "@/components/dashboard/workflow-header";
import { Field } from "@/components/forms/field";
import { FormSection } from "@/components/forms/form-section";
import { PendingButton } from "@/components/forms/pending-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCustomerById } from "@/lib/queries";

export default async function EditCustomerPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const action = updateCustomer.bind(null, id);

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title="Edit customer"
        subtitle={`Update ${customer.name}'s record.`}
        backHref="/dashboard/customers"
        backLabel="Back to customers"
      />

      <form action={action} className="space-y-4">
        {query.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {query.error}
          </div>
        ) : null}
        <FormSection title="Customer details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field htmlFor="name" label="Name">
              <Input id="name" name="name" defaultValue={customer.name} required />
            </Field>
            <Field htmlFor="email" label="Email">
              <Input id="email" name="email" type="email" defaultValue={customer.email ?? ""} />
            </Field>
            <Field htmlFor="phone" label="Phone">
              <Input id="phone" name="phone" defaultValue={customer.phone ?? ""} />
            </Field>
          </div>
          <Field htmlFor="address" label="Address">
            <Textarea id="address" name="address" defaultValue={customer.address ?? ""} />
          </Field>
        </FormSection>

        <div className="flex gap-3">
          <PendingButton pendingLabel="Updating customer...">Update customer</PendingButton>
          <Link href="/dashboard/customers" className={buttonVariants({ variant: "secondary" })}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
