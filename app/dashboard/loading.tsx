import {
  DashboardHeaderSkeleton,
  StatCardsSkeleton,
  TableCardSkeleton
} from "@/components/dashboard/loading-state";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <DashboardHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <TableCardSkeleton rows={5} columns={5} />
        <TableCardSkeleton rows={3} columns={1} />
      </div>
    </div>
  );
}
