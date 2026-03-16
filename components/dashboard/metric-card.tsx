import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "brand"
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  tone?: "brand" | "sky";
}) {
  return (
    <Card className="relative overflow-hidden border-slate-200/80 bg-white/95 p-6">
      <div
        className={
          tone === "sky"
            ? "absolute right-0 top-0 h-28 w-28 rounded-full bg-sky-100 blur-2xl"
            : "absolute right-0 top-0 h-28 w-28 rounded-full bg-brand-100 blur-2xl"
        }
      />
      <div className="relative space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="text-3xl font-semibold tracking-tight text-ink">{value}</p>
          </div>
          <div
            className={
              tone === "sky"
                ? "rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sky-700"
                : "rounded-2xl border border-brand-200 bg-brand-50 p-3 text-brand-700"
            }
          >
            {icon}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="max-w-[17rem] text-sm text-slate-500">{detail}</p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-400">
            Live
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Card>
  );
}
