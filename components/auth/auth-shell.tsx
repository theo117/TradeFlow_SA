import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-hero-grid px-4 py-12">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] bg-ink p-10 text-white shadow-panel">
          <p className="text-xs uppercase tracking-[0.4em] text-brand-200">
            TradeFlow SA
          </p>
          <h1 className="mt-4 max-w-lg text-4xl font-semibold leading-tight">
            Faster quotes and cleaner customer records for South African service teams.
          </h1>
          <p className="mt-4 max-w-md text-sm text-slate-300">
            Launch with secure auth, a focused dashboard, and quote management built for small businesses.
          </p>
        </div>
        <Card className="flex items-center">
          <div className="w-full space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-ink">{title}</h2>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>
        </Card>
      </div>
    </div>
  );
}
