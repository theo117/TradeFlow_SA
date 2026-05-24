"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createInvoiceFromRecurringTemplate,
  updateRecurringInvoiceTemplateStatus
} from "@/app/dashboard/recurring/actions";
import { InlineToast, type InlineToastState } from "@/components/feedback/inline-toast";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RecurringInvoiceTemplate } from "@/lib/types";
import { currency, formatDate } from "@/lib/utils";

export function RecurringInvoicesTable({
  templates
}: {
  templates: RecurringInvoiceTemplate[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<InlineToastState>(null);

  async function handleStatus(
    template: RecurringInvoiceTemplate,
    status: "active" | "paused"
  ) {
    setPendingId(template.id);
    const result = await updateRecurringInvoiceTemplateStatus(template.id, status);
    setToast({
      kind: result.error ? "error" : "success",
      message: result.message
    });
    router.refresh();
    setPendingId(null);
  }

  async function handleCreateInvoice(template: RecurringInvoiceTemplate) {
    setPendingId(template.id);
    const result = await createInvoiceFromRecurringTemplate(template.id);

    if (result.error) {
      setToast({ kind: "error", message: result.message });
      setPendingId(null);
      return;
    }

    setToast({ kind: "success", message: result.message });
    router.refresh();
    setPendingId(null);
  }

  return (
    <>
      <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
        <div className="hidden md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Template</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Frequency</th>
                <th className="px-6 py-3 font-medium">Next invoice</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {templates.map((template) => (
                <tr key={template.id} className="transition hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <p className="font-medium text-ink">{template.name}</p>
                    <p className="text-sm text-slate-500">{template.description}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {template.customer ? (
                      <Link
                        href={`/dashboard/customers/${template.customer.id}`}
                        className="font-medium text-ink hover:text-brand-700"
                      >
                        {template.customer.name}
                      </Link>
                    ) : (
                      "Unknown customer"
                    )}
                  </td>
                  <td className="px-6 py-4 capitalize text-slate-500">
                    {template.frequency}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {formatDate(template.next_invoice_date)}
                  </td>
                  <td className="px-6 py-4 font-medium text-ink">
                    {currency(Number(template.total))}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={template.status === "active" ? "paid" : "draft"}
                      >
                        {template.status}
                      </Badge>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pendingId === template.id}
                        onClick={() => handleCreateInvoice(template)}
                      >
                        {pendingId === template.id ? "Working..." : "Create invoice"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pendingId === template.id}
                        onClick={() =>
                          handleStatus(
                            template,
                            template.status === "active" ? "paused" : "active"
                          )
                        }
                      >
                        {template.status === "active" ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No recurring invoices yet. Add one for retainers, maintenance,
                    or monthly service contracts.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {templates.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No recurring invoices yet. Add one for retainers, maintenance, or
              monthly service contracts.
            </div>
          ) : null}
          {templates.map((template) => (
            <div key={template.id} className="space-y-4 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">{template.name}</p>
                  <p className="text-sm text-slate-500">
                    {template.customer?.name ?? "Unknown customer"}
                  </p>
                </div>
                <Badge variant={template.status === "active" ? "paid" : "draft"}>
                  {template.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Next invoice</p>
                  <p className="font-medium text-ink">
                    {formatDate(template.next_invoice_date)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-medium text-ink">
                    {currency(Number(template.total))}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pendingId === template.id}
                  onClick={() => handleCreateInvoice(template)}
                >
                  Create invoice
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pendingId === template.id}
                  onClick={() =>
                    handleStatus(
                      template,
                      template.status === "active" ? "paused" : "active"
                    )
                  }
                >
                  {template.status === "active" ? "Pause" : "Resume"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Link href="/dashboard/invoices" className={buttonVariants({ variant: "secondary" })}>
        View invoices
      </Link>
      <InlineToast toast={toast} onClear={() => setToast(null)} />
    </>
  );
}
