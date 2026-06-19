import { CustomerCreateForm } from "@/components/customers/customer-create-form";
import { WorkflowHeader } from "@/components/dashboard/workflow-header";
import { requirePaidBusiness } from "@/lib/auth";

export default async function NewCustomerPage() {
  await requirePaidBusiness();

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title="Add customer"
        subtitle="Create a customer record for future quotes."
        backHref="/dashboard/customers"
        backLabel="Back to customers"
      />

      <CustomerCreateForm />
    </div>
  );
}
