import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardHeaderSkeleton() {
  return (
    <Card className="space-y-5 border-slate-200/80 bg-white/95 p-6">
      <div className="space-y-3">
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:w-fit">
        <Skeleton className="h-20 w-full min-w-36" />
        <Skeleton className="h-20 w-full min-w-36" />
      </div>
    </Card>
  );
}

export function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="space-y-5 border-slate-200/80 bg-white/95 p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="h-12 w-12 rounded-2xl" />
          </div>
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ))}
    </div>
  );
}

export function TableCardSkeleton({
  rows = 5,
  columns = 4
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
      <div className="space-y-3 border-b border-slate-200 px-6 py-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="space-y-4 px-6 py-5">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, colIndex) => (
              <Skeleton key={colIndex} className="h-12 w-full" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      <DashboardHeaderSkeleton />
      <Card className="space-y-5 border-slate-200/80 bg-white/95 p-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-36 w-full" />
      </Card>
      <div className="flex gap-3">
        <Skeleton className="h-11 w-36" />
        <Skeleton className="h-11 w-28" />
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <DashboardHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <TableCardSkeleton rows={4} columns={4} />
        <Card className="space-y-4 border-slate-200/80 bg-white/95 p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    </div>
  );
}
