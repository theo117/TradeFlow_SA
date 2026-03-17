import { CustomersTable } from "@/components/dashboard/customers-table";
import { ResourceHeader } from "@/components/dashboard/resource-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getCustomers } from "@/lib/queries";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <ResourceHeader
        title="Customers"
        subtitle="Manage the businesses and contacts you quote for."
        ctaHref="/dashboard/customers/new"
        ctaLabel="Add customer"
        stats={[
          { label: "Total customers", value: customers.length },
          {
            label: "With email",
            value: customers.filter((customer) => customer.email).length
          },
          {
            label: "WhatsApp ready",
            value: customers.filter(
              (customer) => customer.whatsapp_phone && customer.whatsapp_opt_in
            ).length
          }
        ]}
      />

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to start creating quotes with linked contact details."
          ctaHref="/dashboard/customers/new"
          ctaLabel="Add customer"
        />
      ) : (
        <CustomersTable customers={customers} />
      )}
    </div>
  );
}
