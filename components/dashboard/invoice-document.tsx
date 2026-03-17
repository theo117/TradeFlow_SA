import Image from "next/image";
import { ReactNode } from "react";
import { WhatsAppDeliveryBadge } from "@/components/dashboard/whatsapp-delivery-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currency, formatDate } from "@/lib/utils";

type InvoiceDocumentProps = {
  invoice: {
    invoice_number: string;
    status: "draft" | "sent" | "paid" | "overdue";
    total: number;
    due_date: string;
    created_at: string;
    whatsapp_delivery_status?: "queued" | "sent" | "delivered" | "read" | "failed" | null;
    items?: Array<{
      id?: string;
      description: string;
      quantity: number;
      price: number;
      subtotal: number;
    }>;
  };
  business: {
    name: string;
    logo_url?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    vat_number?: string | null;
    registration_number?: string | null;
    bank_name?: string | null;
    bank_account_name?: string | null;
    bank_account_number?: string | null;
    bank_branch_code?: string | null;
    payment_instructions?: string | null;
  };
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  actions?: ReactNode;
};

export function InvoiceDocument({
  invoice,
  business,
  customer,
  actions
}: InvoiceDocumentProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Invoice overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            {invoice.invoice_number}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={invoice.status}>{invoice.status}</Badge>
          <WhatsAppDeliveryBadge status={invoice.whatsapp_delivery_status} />
          {actions}
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_100%)] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.34em] text-brand-600">
                TradeFlow SA
              </div>
              {business.logo_url ? (
                <Image
                  src={business.logo_url}
                  alt={`${business.name} logo`}
                  width={160}
                  height={64}
                  className="mt-4 h-16 w-auto rounded-xl object-contain"
                />
              ) : null}
              <h2 className="mt-3 text-3xl font-semibold text-ink">{business.name}</h2>
              <div className="mt-3 space-y-1 text-sm text-slate-500">
                <p>{business.address ?? "Business address not added yet."}</p>
                <p>{business.email ?? "Business email not added yet."}</p>
                <p>{business.phone ?? "Business phone not added yet."}</p>
                {business.registration_number ? (
                  <p>Registration: {business.registration_number}</p>
                ) : null}
                {business.vat_number ? <p>VAT: {business.vat_number}</p> : null}
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white/80 p-5 text-sm sm:grid-cols-2">
              <MetaItem label="Invoice number" value={invoice.invoice_number} />
              <MetaItem label="Invoice date" value={formatDate(invoice.created_at)} />
              <MetaItem label="Due date" value={formatDate(invoice.due_date)} />
              <MetaItem label="Status" value={invoice.status} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 border-b border-slate-200 px-6 py-6 sm:px-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Bill to
            </p>
            <h3 className="mt-2 text-lg font-semibold text-ink">{customer.name}</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-500">
              <p>{customer.email ?? "No email provided"}</p>
              <p>{customer.phone ?? "No phone provided"}</p>
              <p>{customer.address ?? "No address provided"}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Payment instructions
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {business.payment_instructions ??
                "Please pay by the due date and use the invoice number as your payment reference."}
            </p>
            {business.bank_name ||
            business.bank_account_name ||
            business.bank_account_number ||
            business.bank_branch_code ? (
              <div className="mt-4 space-y-1 text-sm text-slate-500">
                {business.bank_name ? <p>Bank: {business.bank_name}</p> : null}
                {business.bank_account_name ? (
                  <p>Account name: {business.bank_account_name}</p>
                ) : null}
                {business.bank_account_number ? (
                  <p>Account number: {business.bank_account_number}</p>
                ) : null}
                {business.bank_branch_code ? (
                  <p>Branch code: {business.bank_branch_code}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Quantity</th>
                  <th className="px-6 py-3 font-medium">Price</th>
                  <th className="px-6 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invoice.items?.map((item) => (
                  <tr
                    key={item.id ?? item.description}
                    className="transition hover:bg-slate-50/80"
                  >
                    <td className="px-6 py-4 font-medium text-ink">{item.description}</td>
                    <td className="px-6 py-4 text-slate-500">{item.quantity}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {currency(Number(item.price))}
                    </td>
                    <td className="px-6 py-4 font-medium text-ink">
                      {currency(Number(item.subtotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-[#0b1020] px-6 py-5 text-white sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-slate-300">Amount due</p>
              <p className="mt-1 text-3xl font-semibold">{currency(Number(invoice.total))}</p>
            </div>
            <div className="text-sm text-slate-300">
              Due by {formatDate(invoice.due_date)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium capitalize text-ink">{value}</p>
    </div>
  );
}
