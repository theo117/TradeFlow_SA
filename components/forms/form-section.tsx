import { ReactNode } from "react";

export function FormSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5 rounded-[28px] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Form section
        </p>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
