import { CheckCircle2, Sparkles } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { getPlanAmount } from "@/lib/payfast";
import { currency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { startBillingCheckout } from "./actions";

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const business = await requireBusiness();
  const params = await searchParams;
  const starterAmount = Number(getPlanAmount("starter"));
  const proAmount = Number(getPlanAmount("pro"));
  const accessLabel =
    business.subscription_status === "active"
      ? "Active"
      : business.subscription_status === "past_due"
        ? "Past due"
        : business.subscription_status === "cancelled"
          ? "Cancelled"
          : "Trial";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Billing
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Plan and billing</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage your TradeFlow SA plan, subscription status, and Payfast checkout.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Access</p>
          <p className="mt-1 text-lg font-semibold text-ink">{accessLabel}</p>
          <p className="text-sm text-slate-500">
            {business.billing_plan_id ? `${business.billing_plan_id} plan` : "No paid plan"}
          </p>
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
                Your team can use customers, services, quotes, invoices, and business settings while access is active.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Subscription status</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{accessLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Current period ends</p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {business.current_period_end
                  ? formatDate(business.current_period_end)
                  : "Not set"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-brand-600" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Payfast checkout
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">Choose a plan</h2>
              <p className="mt-2 text-sm text-slate-500">
                Use Payfast sandbox first, then switch the Payfast URLs and merchant credentials for production.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Starter</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {currency(starterAmount)} / month
              </p>
              <form action={startBillingCheckout.bind(null, "starter")} className="mt-4">
                <Button type="submit" className="w-full">
                  Start Starter
                </Button>
              </form>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Pro</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {currency(proAmount)} / month
              </p>
              <form action={startBillingCheckout.bind(null, "pro")} className="mt-4">
                <Button type="submit" variant="secondary" className="w-full">
                  Start Pro
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
