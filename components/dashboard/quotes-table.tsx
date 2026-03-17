"use client";

import Link from "next/link";
import { startTransition, useCallback, useMemo, useState } from "react";
import { ArrowUpRight, FileText, SendHorizontal, Trash2 } from "lucide-react";
import { deleteQuote, updateQuoteStatus } from "@/app/dashboard/quotes/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ListToolbar } from "@/components/dashboard/list-toolbar";
import { SortHeader } from "@/components/dashboard/sort-header";
import { InlineToast } from "@/components/feedback/inline-toast";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useListState } from "@/hooks/use-list-state";
import { useOptimisticDelete } from "@/hooks/use-optimistic-delete";
import type { Quote } from "@/lib/types";
import { currency, formatDate } from "@/lib/utils";

type QuoteRow = Pick<Quote, "id" | "status" | "total" | "created_at"> & {
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export function QuotesTable({ quotes }: { quotes: QuoteRow[] }) {
  const PAGE_SIZE = 6;
  const [rows, setRows] = useState(quotes);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "sent">("all");
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);
  const filteredRows = useMemo(
    () => rows.filter((quote) => statusFilter === "all" || quote.status === statusFilter),
    [rows, statusFilter]
  );

  const matchesSearch = useCallback(
    (quote: QuoteRow, term: string) =>
      term.length === 0 ||
      [
        quote.customer?.name ?? "",
        quote.customer?.email ?? "",
        quote.customer?.phone ?? "",
        quote.id,
        String(quote.total)
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    []
  );

  const compare = useCallback(
    (
      a: QuoteRow,
      b: QuoteRow,
      sortKey: "created_at" | "total" | "customer",
      direction: "asc" | "desc"
    ) => {
      const factor = direction === "asc" ? 1 : -1;

      if (sortKey === "created_at") {
        return (
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
          factor
        );
      }

      if (sortKey === "total") {
        return (Number(a.total) - Number(b.total)) * factor;
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
  } = useListState<QuoteRow, "created_at" | "total" | "customer">({
    items: filteredRows,
    pageSize: PAGE_SIZE,
    initialSortKey: "created_at",
    initialSortDirection: "desc",
    matchesSearch,
    compare,
    resetDependencies: [statusFilter]
  });
  const { target, setTarget, pendingId, toast, setToast, confirmDelete } =
    useOptimisticDelete({
      items: rows,
      setItems: setRows,
      deleteAction: deleteQuote,
      formField: "quoteId"
    });

  async function handleStatusToggle(quote: QuoteRow) {
    const nextStatus: QuoteRow["status"] =
      quote.status === "draft" ? "sent" : "draft";
    const snapshot = rows;
    const nextRows = rows.map((row) =>
      row.id === quote.id ? { ...row, status: nextStatus } : row
    );

    setStatusPendingId(quote.id);
    startTransition(() => {
      setRows(nextRows);
    });

    const result = await updateQuoteStatus(quote.id, nextStatus);

    if (result?.error) {
      setRows(snapshot);
      setToast({ kind: "error", message: result.message });
    } else {
      setToast({
        kind: "success",
        message: result?.message ?? `Quote marked as ${nextStatus}`
      });
    }

    setStatusPendingId(null);
  }

  return (
    <>
      <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Quote pipeline
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">All quotes</h2>
        </div>

        <ListToolbar
          searchValue={search}
          searchPlaceholder="Search by customer, quote ID, email, phone, or value"
          onSearchChange={setSearch}
          filterValue={statusFilter}
          filterOptions={[
            { label: "All statuses", value: "all" },
            { label: "Draft", value: "draft" },
            { label: "Sent", value: "sent" }
          ]}
          onFilterChange={(value) => setStatusFilter(value as "all" | "draft" | "sent")}
          resultLabel={`${processedItems.length} of ${rows.length} quotes`}
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
                    label="Customer"
                    active={sortKey === "customer"}
                    direction={sortDirection}
                    onClick={() => toggleSort("customer", "asc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Date"
                    active={sortKey === "created_at"}
                    direction={sortDirection}
                    onClick={() => toggleSort("created_at", "desc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Total"
                    active={sortKey === "total"}
                    direction={sortDirection}
                    onClick={() => toggleSort("total", "desc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedItems.map((quote) => (
                <tr key={quote.id} className="transition hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <div className="font-medium text-ink">
                      {quote.customer?.name ?? "Unknown customer"}
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Quote #{quote.id.slice(0, 8).toUpperCase()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(quote.created_at)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={quote.status}>{quote.status}</Badge>
                  </td>
                  <td className="px-6 py-4 font-medium text-ink">{currency(Number(quote.total))}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleStatusToggle(quote)}
                        disabled={pendingId === quote.id || statusPendingId === quote.id}
                      >
                        {statusPendingId === quote.id
                          ? "Updating..."
                          : quote.status === "draft"
                            ? "Mark sent"
                            : "Mark draft"}
                      </Button>
                      <Link
                        href={`/dashboard/quotes/${quote.id}`}
                        className={buttonVariants({ variant: "secondary" })}
                      >
                        View
                      </Link>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setTarget(quote)}
                        disabled={pendingId === quote.id}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    {rows.length === 0
                      ? "No quotes left. Create a new quote to restart the pipeline."
                      : "No quotes match your current filters."}
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
                ? "No quotes left. Create a new quote to restart the pipeline."
                : "No quotes match your current filters."}
            </div>
          ) : null}
          {paginatedItems.map((quote) => (
            <div key={quote.id} className="space-y-4 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {quote.customer?.name ?? "Unknown customer"}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Quote #{quote.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                {quote.status === "sent" ? (
                  <SendHorizontal className="h-5 w-5 text-emerald-500" />
                ) : (
                  <FileText className="h-5 w-5 text-amber-500" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <Badge variant={quote.status}>{quote.status}</Badge>
                <span className="font-medium text-ink">{currency(Number(quote.total))}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{formatDate(quote.created_at)}</span>
                <Link
                  href={`/dashboard/quotes/${quote.id}`}
                  className="inline-flex items-center gap-1 font-medium text-brand-700"
                >
                  View
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleStatusToggle(quote)}
                  disabled={pendingId === quote.id || statusPendingId === quote.id}
                >
                  {statusPendingId === quote.id
                    ? "Updating..."
                    : quote.status === "draft"
                      ? "Mark sent"
                      : "Mark draft"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setTarget(quote)}
                  disabled={pendingId === quote.id}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        <ListPagination
          currentPage={page}
          totalPages={totalPages}
          itemLabel="quotes"
          rangeLabel={`${Math.min((page - 1) * PAGE_SIZE + 1, processedItems.length)}-${Math.min(page * PAGE_SIZE, processedItems.length)} of ${processedItems.length}`}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        />
      </Card>

      <ConfirmDialog
        open={!!target}
        title={`Delete quote ${target?.id.slice(0, 8).toUpperCase() ?? ""}?`}
        description="This quote and its line items will be removed permanently from your workspace."
        confirmLabel="Delete quote"
        pending={!!pendingId}
        onCancel={() => !pendingId && setTarget(null)}
        onConfirm={confirmDelete}
      />

      <InlineToast toast={toast} onClear={() => setToast(null)} />
    </>
  );
}
