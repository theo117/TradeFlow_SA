import { CheckCircle2, Sparkles } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const business = await requireBusiness();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Billing
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Plan and billing</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            TradeFlow SA is free during early access while the workflow, pricing, and billing model are still being refined.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Access</p>
          <p className="mt-1 text-lg font-semibold text-ink">Free</p>
          <p className="text-sm text-slate-500">Early access</p>
        </div>
      </div>

      {params.success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {params.success}
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {params.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-xl font-semibold text-ink">Workspace access is active</h2>
              <p className="mt-2 text-sm text-slate-500">
                Your team can use customers, services, quotes, invoices, and business settings without billing turned on.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Current mode</p>
              <p className="mt-1 text-2xl font-semibold text-ink">Free access</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Joined</p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {formatDate(business.created_at)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-brand-600" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Coming later
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">Monetisation can wait</h2>
              <p className="mt-2 text-sm text-slate-500">
                Focus first on adoption, feedback, and product quality. Billing can be switched on once the workflow is strong and the business registration details are ready.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Now</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                Get users in, learn the workflow, and improve the product
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Later</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                Turn on billing when pricing, compliance, and merchant details are ready
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
