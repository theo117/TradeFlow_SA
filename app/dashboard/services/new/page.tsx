import Link from "next/link";
import { createService } from "@/app/dashboard/services/actions";
import { WorkflowHeader } from "@/components/dashboard/workflow-header";
import { Field } from "@/components/forms/field";
import { FormSection } from "@/components/forms/form-section";
import { PendingButton } from "@/components/forms/pending-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requirePaidBusiness } from "@/lib/auth";

export default async function NewServicePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePaidBusiness();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title="Add service"
        subtitle="Create a billable service or product."
        backHref="/dashboard/services"
        backLabel="Back to services"
      />

      <form action={createService} className="space-y-4">
        {params.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {params.error}
          </div>
        ) : null}
        <FormSection title="Service details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field htmlFor="name" label="Name">
              <Input id="name" name="name" required />
            </Field>
            <Field htmlFor="price" label="Price (ZAR)">
              <Input id="price" name="price" type="number" min="0" step="0.01" required />
            </Field>
          </div>
          <Field htmlFor="description" label="Description">
            <Textarea id="description" name="description" />
          </Field>
        </FormSection>

        <div className="flex gap-3">
          <PendingButton pendingLabel="Saving service...">Save service</PendingButton>
          <Link href="/dashboard/services" className={buttonVariants({ variant: "secondary" })}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
