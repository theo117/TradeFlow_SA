import { Sparkles } from "lucide-react";

export function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur xl:flex-row xl:items-end xl:justify-between">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">
          <Sparkles className="h-3.5 w-3.5" />
          Business Workspace
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm sm:w-fit">
        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
          <p className="text-slate-400">Mode</p>
          <p className="mt-1 font-medium text-ink">Operational</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
          <p className="text-slate-400">Region</p>
          <p className="mt-1 font-medium text-ink">South Africa</p>
        </div>
      </div>
    </div>
  );
}
