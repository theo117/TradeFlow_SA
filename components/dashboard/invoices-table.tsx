"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Download, ReceiptText } from "lucide-react";
import { updateInvoiceStatus } from "@/app/dashboard/invoices/actions";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ListToolbar } from "@/components/dashboard/list-toolbar";
import { SortHeader } from "@/components/dashboard/sort-header";
import { InlineToast, type InlineToastState } from "@/components/feedback/inline-toast";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useListState } from "@/hooks/use-list-state";
import type { Invoice } from "@/lib/types";
import { currency, formatDate } from "@/lib/utils";

type InvoiceRow = Pick<
  Invoice,
  "id" | "invoice_number" | "status" | "total" | "due_date" | "created_at"
> & {
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export function InvoicesTable({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const PAGE_SIZE = 6;
  const [rows, setRows] = useState(invoices);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "sent" | "paid" | "overdue"
  >("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<InlineToastState>(null);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (invoice) => statusFilter === "all" || invoice.status === statusFilter
      ),
    [rows, statusFilter]
  );

  const matchesSearch = useCallback(
    (invoice: InvoiceRow, term: string) =>
      term.length === 0 ||
      [
        invoice.invoice_number,
        invoice.customer?.name ?? "",
        invoice.customer?.email ?? "",
        invoice.customer?.phone ?? "",
        String(invoice.total)
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    []
  );

  const compare = useCallback(
    (
      a: InvoiceRow,
      b: InvoiceRow,
      sortKey: "due_date" | "total" | "customer" | "invoice_number",
      direction: "asc" | "desc"
    ) => {
      const factor = direction === "asc" ? 1 : -1;

      if (sortKey === "due_date") {
        return (new Date(a.due_date).getTime() - new Date(b.due_date).getTime()) * factor;
      }

      if (sortKey === "total") {
        return (Number(a.total) - Number(b.total)) * factor;
      }

      if (sortKey === "invoice_number") {
        return a.invoice_number.localeCompare(b.invoice_number) * factor;
      }

      return (
        (a.customer?.name ?? "Unknown customer").localeCompare(
          b.customer?.name ?? "Unknown customer"
        ) * factor
      );
    },
    []
  );

  const {
    search,
    setSearch,
    page,
    setPage,
    sortKey,
    sortDirection,
    toggleSort,
    processedItems,
    paginatedItems,
    totalPages,
    resetSearch
  } = useListState<
    InvoiceRow,
    "due_date" | "total" | "customer" | "invoice_number"
  >({
    items: filteredRows,
    pageSize: PAGE_SIZE,
    initialSortKey: "due_date",
    initialSortDirection: "asc",
    matchesSearch,
    compare,
    resetKey: statusFilter
  });

  async function handleMarkPaid(invoiceId: string) {
    const snapshot = rows;
    setPendingId(invoiceId);
    setRows((current) =>
      current.map((invoice) =>
        invoice.id === invoiceId ? { ...invoice, status: "paid" } : invoice
      )
    );

    const result = await updateInvoiceStatus(invoiceId, "paid");

    if (result?.error) {
      setRows(snapshot);
      setToast({ kind: "error", message: result.message });
    } else {
      setToast({ kind: "success", message: result.message });
      router.refresh();
    }

    setPendingId(null);
  }

  return (
    <>
      <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Revenue operations
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">All invoices</h2>
        </div>

        <ListToolbar
          searchValue={search}
          searchPlaceholder="Search by invoice, customer, phone, email, or value"
          onSearchChange={setSearch}
          filterValue={statusFilter}
          filterOptions={[
            { label: "All statuses", value: "all" },
            { label: "Draft", value: "draft" },
            { label: "Sent", value: "sent" },
            { label: "Paid", value: "paid" },
            { label: "Overdue", value: "overdue" }
          ]}
          onFilterChange={(value) =>
            setStatusFilter(value as "all" | "draft" | "sent" | "paid" | "overdue")
          }
          resultLabel={`${processedItems.length} of ${rows.length} invoices`}
          onReset={() => {
            resetSearch();
            setStatusFilter("all");
          }}
        />

        <div className="hidden md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Invoice"
                    active={sortKey === "invoice_number"}
                    direction={sortDirection}
                    onClick={() => toggleSort("invoice_number", "asc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Customer"
                    active={sortKey === "customer"}
                    direction={sortDirection}
                    onClick={() => toggleSort("customer", "asc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Due date"
                    active={sortKey === "due_date"}
                    direction={sortDirection}
                    onClick={() => toggleSort("due_date", "asc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Amount"
                    active={sortKey === "total"}
                    direction={sortDirection}
                    onClick={() => toggleSort("total", "desc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedItems.map((invoice) => (
                <tr key={invoice.id} className="transition hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <div className="font-medium text-ink">{invoice.invoice_number}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Created {formatDate(invoice.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-ink">
                      {invoice.customer?.name ?? "Unknown customer"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {invoice.customer?.email ??
                        invoice.customer?.phone ??
                        "No contact details"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={invoice.status}>{invoice.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(invoice.due_date)}</td>
                  <td className="px-6 py-4 font-medium text-ink">
                    {currency(Number(invoice.total))}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className={buttonVariants({ variant: "secondary" })}
                      >
                        View
                      </Link>
                      {invoice.status !== "paid" ? (
                        <Button
                          type="button"
                          onClick={() => handleMarkPaid(invoice.id)}
                          disabled={pendingId === invoice.id}
                        >
                          {pendingId === invoice.id ? "Updating..." : "Mark paid"}
                        </Button>
                      ) : null}
                      <Link
                        href={`/api/invoices/${invoice.id}/pdf`}
                        className={buttonVariants({ variant: "secondary" })}
                      >
                        Download PDF
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {rows.length === 0
                      ? "No invoices yet. Convert your first quote to begin billing."
                      : "No invoices match your current filters."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {paginatedItems.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              {rows.length === 0
                ? "No invoices yet. Convert your first quote to begin billing."
                : "No invoices match your current filters."}
            </div>
          ) : null}
          {paginatedItems.map((invoice) => (
            <div key={invoice.id} className="space-y-4 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{invoice.invoice_number}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {invoice.customer?.name ?? "Unknown customer"}
                  </p>
                </div>
                {invoice.status === "paid" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ReceiptText className="h-5 w-5 text-brand-600" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <Badge variant={invoice.status}>{invoice.status}</Badge>
                <span className="font-medium text-ink">
                  {currency(Number(invoice.total))}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Due {formatDate(invoice.due_date)}</span>
                <Link
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="inline-flex items-center gap-1 font-medium text-brand-700"
                >
                  View
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                {invoice.status !== "paid" ? (
                  <Button
                    type="button"
                    onClick={() => handleMarkPaid(invoice.id)}
                    disabled={pendingId === invoice.id}
                  >
                    {pendingId === invoice.id ? "Updating..." : "Mark paid"}
                  </Button>
                ) : null}
                <Link
                  href={`/api/invoices/${invoice.id}/pdf`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Link>
              </div>
            </div>
          ))}
        </div>

        <ListPagination
          currentPage={page}
          totalPages={totalPages}
          itemLabel="invoices"
          rangeLabel={`${Math.min((page - 1) * PAGE_SIZE + 1, processedItems.length)}-${Math.min(page * PAGE_SIZE, processedItems.length)} of ${processedItems.length}`}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        />
      </Card>

      <InlineToast toast={toast} onClear={() => setToast(null)} />
    </>
  );
}
