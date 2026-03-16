import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ResourceStat = {
  label: string;
  value: string | number;
};

export function ResourceHeader({
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  stats
}: {
  title: string;
  subtitle: string;
  ctaHref: string;
  ctaLabel: string;
  stats: ResourceStat[];
}) {
  return (
    <div className="space-y-4">
      <Topbar title={title} subtitle={subtitle} />

      <Card className="border-slate-200/80 bg-white/95 p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
              >
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href={ctaHref} className={buttonVariants({})}>
              {ctaLabel}
            </Link>
            <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:flex">
              Ready to update
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
