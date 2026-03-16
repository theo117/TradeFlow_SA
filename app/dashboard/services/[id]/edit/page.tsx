import Link from "next/link";
import { notFound } from "next/navigation";
import { updateService } from "@/app/dashboard/services/actions";
import { WorkflowHeader } from "@/components/dashboard/workflow-header";
import { Field } from "@/components/forms/field";
import { FormSection } from "@/components/forms/form-section";
import { PendingButton } from "@/components/forms/pending-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getServiceById } from "@/lib/queries";

export default async function EditServicePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const service = await getServiceById(id);

  if (!service) {
    notFound();
  }

  const action = updateService.bind(null, id);

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title="Edit service"
        subtitle={`Update ${service.name}.`}
        backHref="/dashboard/services"
        backLabel="Back to services"
      />

      <form action={action} className="space-y-4">
        {query.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {query.error}
          </div>
        ) : null}
        <FormSection title="Service details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field htmlFor="name" label="Name">
              <Input id="name" name="name" defaultValue={service.name} required />
            </Field>
            <Field htmlFor="price" label="Price (ZAR)">
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={Number(service.price)}
                required
              />
            </Field>
          </div>
          <Field htmlFor="description" label="Description">
            <Textarea id="description" name="description" defaultValue={service.description ?? ""} />
          </Field>
        </FormSection>

        <div className="flex gap-3">
          <PendingButton pendingLabel="Updating service...">Update service</PendingButton>
          <Link href="/dashboard/services" className={buttonVariants({ variant: "secondary" })}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
