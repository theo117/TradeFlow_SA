import Link from "next/link";
import { CheckCircle2, Mail, MessageCircle, Sparkles } from "lucide-react";
import { getAccessState, requireBusiness } from "@/lib/auth";
import { getPlanAmount } from "@/lib/payfast";
import { currency, formatDate } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { startBillingCheckout } from "./actions";

function getOptionalPlanAmount(plan: "starter" | "pro") {
  try {
    return Number(getPlanAmount(plan));
  } catch {
    return null;
  }
}

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const business = await requireBusiness();
  const params = await searchParams;
  const starterAmount = getOptionalPlanAmount("starter");
  const proAmount = getOptionalPlanAmount("pro");
  const accessState = getAccessState(business);
  const contactEmail =
    process.env.CONTINUATION_CONTACT_EMAIL ?? "support@tradeflowsa.co.za";
  const contactWhatsapp = process.env.CONTINUATION_CONTACT_WHATSAPP;
  const contactSubject = encodeURIComponent("Continue using TradeFlow SA");
  const contactBody = encodeURIComponent(
    `Hi, I want to keep using TradeFlow SA for ${business.name}.`
  );
  const accessLabel =
    accessState.hasAccess && business.subscription_status === "active"
      ? "Active"
      : accessState.hasAccess && business.subscription_status === "trialing"
        ? "Trial"
      : business.subscription_status === "past_due"
        ? "Past due"
        : business.subscription_status === "cancelled"
          ? "Cancelled"
          : "Expired";
  const accessEndsLabel = accessState.accessEndsAt
    ? formatDate(accessState.accessEndsAt)
    : "Not set";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Billing
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Plan and billing</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Your key workflows are available for {accessState.trialDays} days. Contact us if you want to keep using TradeFlow SA after that.
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

      {!accessState.hasAccess ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">
                Access paused
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                Want to keep using TradeFlow SA?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900/80">
                Your {accessState.trialDays}-day access window has ended. Contact us and we will help extend access, set up a pilot, or move you to a paid plan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`mailto:${contactEmail}?subject=${contactSubject}&body=${contactBody}`}
                className={buttonVariants({})}
              >
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact by email
                </span>
              </Link>
              {contactWhatsapp ? (
                <Link
                  href={`https://wa.me/${contactWhatsapp.replace(/\D/g, "")}?text=${contactBody}`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  <span className="inline-flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </span>
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-xl font-semibold text-ink">Workspace access is active</h2>
              <p className="mt-2 text-sm text-slate-500">
                Key workflows like customers, services, quotes, invoices, exports, and PDFs remain available while access is active.
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
                {accessEndsLabel}
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
                You can keep Payfast off for now and use the contact buttons above to handle continuation manually.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Starter</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {starterAmount ? `${currency(starterAmount)} / month` : "Manual setup"}
              </p>
              <form action={startBillingCheckout.bind(null, "starter")} className="mt-4">
                <Button type="submit" className="w-full" disabled={!starterAmount}>
                  Start Starter
                </Button>
              </form>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Pro</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {proAmount ? `${currency(proAmount)} / month` : "Manual setup"}
              </p>
              <form action={startBillingCheckout.bind(null, "pro")} className="mt-4">
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full"
                  disabled={!proAmount}
                >
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
