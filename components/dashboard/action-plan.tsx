import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileText,
  ReceiptText,
  Settings,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, currency, formatDate } from "@/lib/utils";

type BusinessSnapshot = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  payment_instructions: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
};

type PriorityInvoice = {
  id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue";
  total: number | string;
  due_date: string;
  customer?: {
    name?: string | null;
  } | null;
};

type SetupStep = {
  label: string;
  description: string;
  href: string;
  complete: boolean;
};

function StepIcon({ complete }: { complete: boolean }) {
  return complete ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  ) : (
    <CircleDashed className="h-4 w-4 text-slate-400" />
  );
}

export function DashboardActionPlan({
  business,
  customerCount,
  serviceCount,
  quoteCount,
  sentQuoteCount,
  draftQuoteCount,
  unpaidInvoiceCount,
  overdueInvoiceCount,
  outstandingInvoiceValue,
  priorityInvoices
}: {
  business: BusinessSnapshot;
  customerCount: number;
  serviceCount: number;
  quoteCount: number;
  sentQuoteCount: number;
  draftQuoteCount: number;
  unpaidInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingInvoiceValue: number;
  priorityInvoices: PriorityInvoice[];
}) {
  const hasBusinessProfile = Boolean(
    business.name && (business.email || business.phone) && business.address
  );
  const hasBankingDetails = Boolean(
    business.bank_name &&
      business.bank_account_name &&
      business.bank_account_number &&
      business.bank_branch_code
  );
  const hasWhatsAppSetup = Boolean(
    business.whatsapp_phone_number_id && business.whatsapp_business_account_id
  );
  const setupSteps: SetupStep[] = [
    {
      label: "Complete business profile",
      description: "Show your name, contact details, address, and logo on documents.",
      href: "/dashboard/settings",
      complete: hasBusinessProfile && Boolean(business.logo_url)
    },
    {
      label: "Add banking details",
      description: "Let customers pay by EFT without a back-and-forth message.",
      href: "/dashboard/settings",
      complete: hasBankingDetails || Boolean(business.payment_instructions)
    },
    {
      label: "Create service catalogue",
      description: "Save repeat services so quotes stay fast and consistent.",
      href: "/dashboard/services",
      complete: serviceCount > 0
    },
    {
      label: "Add first customers",
      description: "Keep each client history, quote, and invoice in one place.",
      href: "/dashboard/customers/new",
      complete: customerCount > 0
    },
    {
      label: "Send a quote",
      description: "Start the sales flow with a customer-ready quote.",
      href: "/dashboard/quotes/new",
      complete: quoteCount > 0
    },
    {
      label: "Connect WhatsApp",
      description: "Share quotes and payment reminders where clients respond fastest.",
      href: "/dashboard/settings",
      complete: hasWhatsAppSetup
    }
  ];
  const completedSteps = setupSteps.filter((step) => step.complete).length;
  const setupProgress = Math.round((completedSteps / setupSteps.length) * 100);

  const priorities = [
    {
      label:
        overdueInvoiceCount > 0
          ? `${overdueInvoiceCount} overdue invoice${overdueInvoiceCount === 1 ? "" : "s"}`
          : "No overdue invoices",
      description:
        overdueInvoiceCount > 0
          ? "Follow up the oldest overdue invoices first."
          : "Collections are under control right now.",
      href: "/dashboard/invoices",
      icon: AlertTriangle,
      urgent: overdueInvoiceCount > 0
    },
    {
      label:
        unpaidInvoiceCount > 0
          ? `${currency(outstandingInvoiceValue)} outstanding`
          : "No outstanding invoice value",
      description:
        unpaidInvoiceCount > 0
          ? "Keep the invoice list clean by marking paid work quickly."
          : "Create invoices from accepted quotes when work is ready to bill.",
      href: "/dashboard/invoices",
      icon: ReceiptText,
      urgent: unpaidInvoiceCount > 0
    },
    {
      label:
        sentQuoteCount > 0
          ? `${sentQuoteCount} quote${sentQuoteCount === 1 ? "" : "s"} waiting`
          : "No sent quotes waiting",
      description:
        sentQuoteCount > 0
          ? "Accepted quotes can become invoices with less admin time."
          : "Send quotes to build your active revenue pipeline.",
      href: "/dashboard/quotes",
      icon: FileText,
      urgent: sentQuoteCount > 0
    },
    {
      label:
        draftQuoteCount > 0
          ? `${draftQuoteCount} draft quote${draftQuoteCount === 1 ? "" : "s"}`
          : "Quote drafts are clear",
      description:
        draftQuoteCount > 0
          ? "Finish or remove old drafts so the pipeline stays honest."
          : "Nothing is stuck before sending.",
      href: "/dashboard/quotes",
      icon: Settings,
      urgent: draftQuoteCount > 0
    }
  ];

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="border-slate-200/80 bg-white/95 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Launch readiness
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Setup checklist</h2>
            <p className="mt-1 text-sm text-slate-500">
              Get the workspace ready for real client documents and collection follow-ups.
            </p>
          </div>
          <div className="min-w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <p className="text-xs text-slate-500">Complete</p>
            <p className="text-2xl font-semibold text-ink">{setupProgress}%</p>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${setupProgress}%` }}
          />
        </div>

        <div className="mt-6 divide-y divide-slate-100">
          {setupSteps.map((step) => (
            <Link
              key={step.label}
              href={step.href}
              className="group flex items-start gap-3 py-4 first:pt-0 last:pb-0"
            >
              <span className="mt-0.5">
                <StepIcon complete={step.complete} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {step.label}
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  {step.description}
                </span>
              </span>
              <ArrowRight
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 transition",
                  step.complete
                    ? "text-slate-300"
                    : "text-brand-700 group-hover:translate-x-0.5"
                )}
              />
            </Link>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Work queue
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Today&apos;s priorities</h2>
            <p className="mt-1 text-sm text-slate-500">
              The next actions that help cash move through the business.
            </p>
          </div>
          <Link
            href="/dashboard/customers/new"
            className={buttonVariants({ variant: "secondary" })}
          >
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              Add client
            </span>
          </Link>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2">
          {priorities.map(({ label, description, href, icon: Icon, urgent }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "group rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-panel",
                urgent
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-slate-200 bg-slate-50/70"
              )}
            >
              <div
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-lg border",
                  urgent
                    ? "border-amber-200 bg-white text-amber-700"
                    : "border-slate-200 bg-white text-slate-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{label}</p>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </Link>
          ))}
        </div>

        <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Invoices to chase</h3>
              <p className="mt-1 text-sm text-slate-500">
                Sorted by due date so follow-ups start with the oldest money.
              </p>
            </div>
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
            >
              Open invoices
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-200">
            {priorityInvoices.length > 0 ? (
              priorityInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {invoice.invoice_number}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {invoice.customer?.name ?? "Unknown customer"} &middot; due{" "}
                      {formatDate(invoice.due_date)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-sm font-semibold text-ink sm:block">
                      {currency(Number(invoice.total))}
                    </span>
                    <Badge variant={invoice.status}>{invoice.status}</Badge>
                  </span>
                </Link>
              ))
            ) : (
              <div className="py-6 text-sm text-slate-500">
                No sent or overdue invoices need follow-up.
              </div>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
