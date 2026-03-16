import {
  DashboardHeaderSkeleton,
  TableCardSkeleton
} from "@/components/dashboard/loading-state";

export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      <DashboardHeaderSkeleton />
      <TableCardSkeleton rows={5} columns={5} />
    </div>
  );
}
