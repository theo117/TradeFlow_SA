import { ServicesTable } from "@/components/dashboard/services-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ResourceHeader } from "@/components/dashboard/resource-header";
import { getServices } from "@/lib/queries";
import { currency } from "@/lib/utils";

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div className="space-y-6">
      <ResourceHeader
        title="Services"
        subtitle="Maintain the services and products used in your quotes."
        ctaHref="/dashboard/services/new"
        ctaLabel="Add service"
        stats={[
          { label: "Total services", value: services.length },
          {
            label: "Average price",
            value:
              services.length === 0
                ? currency(0)
                : currency(
                    services.reduce((sum, service) => sum + Number(service.price), 0) /
                      services.length
                  )
          },
          {
            label: "Highest price",
            value: currency(
              services.reduce(
                (max, service) => Math.max(max, Number(service.price)),
                0
              )
            )
          }
        ]}
      />

      {services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Add your first service or product so it can be used inside quotes."
          ctaHref="/dashboard/services/new"
          ctaLabel="Add service"
        />
      ) : (
        <ServicesTable services={services} />
      )}
    </div>
  );
}
