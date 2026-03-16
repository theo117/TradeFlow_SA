"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Mail, Phone, Trash2, Users } from "lucide-react";
import { deleteCustomer } from "@/app/dashboard/customers/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ListToolbar } from "@/components/dashboard/list-toolbar";
import { SortHeader } from "@/components/dashboard/sort-header";
import { InlineToast } from "@/components/feedback/inline-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useListState } from "@/hooks/use-list-state";
import { useOptimisticDelete } from "@/hooks/use-optimistic-delete";
import type { Customer } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function CustomersTable({ customers }: { customers: Customer[] }) {
  const PAGE_SIZE = 6;
  const [rows, setRows] = useState(customers);
  const matchesSearch = useCallback(
    (customer: Customer, term: string) =>
      term.length === 0 ||
      [customer.name, customer.email ?? "", customer.phone ?? "", customer.address ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    []
  );

  const compare = useCallback(
    (
      a: Customer,
      b: Customer,
      sortKey: "name" | "email" | "created_at",
      direction: "asc" | "desc"
    ) => {
      const factor = direction === "asc" ? 1 : -1;
      if (sortKey === "created_at") {
        return (
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
          factor
        );
      }

      const left = (a[sortKey] ?? "").toString().toLowerCase();
      const right = (b[sortKey] ?? "").toString().toLowerCase();
      return left.localeCompare(right) * factor;
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
  } = useListState({
    items: rows,
    pageSize: PAGE_SIZE,
    initialSortKey: "created_at",
    initialSortDirection: "desc",
    matchesSearch,
    compare
  });
  const { target, setTarget, pendingId, toast, setToast, confirmDelete } =
    useOptimisticDelete({
      items: rows,
      setItems: setRows,
      deleteAction: deleteCustomer,
      formField: "customerId"
    });

  return (
    <>
      <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Customer directory
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">All customers</h2>
        </div>

        <ListToolbar
          searchValue={search}
          searchPlaceholder="Search by name, email, phone, or address"
          onSearchChange={setSearch}
          resultLabel={`${processedItems.length} of ${rows.length} customers`}
          onReset={resetSearch}
        />

        <div className="hidden md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Name"
                    active={sortKey === "name"}
                    direction={sortDirection}
                    onClick={() => toggleSort("name", "asc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Email"
                    active={sortKey === "email"}
                    direction={sortDirection}
                    onClick={() => toggleSort("email", "asc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Created"
                    active={sortKey === "created_at"}
                    direction={sortDirection}
                    onClick={() => toggleSort("created_at", "desc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedItems.map((customer) => (
                <tr
                  key={customer.id}
                  className="transition hover:bg-slate-50/80"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-ink">{customer.name}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Customer
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{customer.email ?? "Not provided"}</td>
                  <td className="px-6 py-4 text-slate-500">{customer.phone ?? "Not provided"}</td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(customer.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/customers/${customer.id}/edit`}
                        className={buttonVariants({ variant: "secondary" })}
                      >
                        Edit
                      </Link>
                      <Button
                        variant="danger"
                        type="button"
                        onClick={() => setTarget(customer)}
                        disabled={pendingId === customer.id}
                      >
                        {pendingId === customer.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    {rows.length === 0
                      ? "No customers left. Add a new customer to keep quoting."
                      : "No customers match your current search."}
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
                ? "No customers left. Add a new customer to keep quoting."
                : "No customers match your current search."}
            </div>
          ) : null}
          {paginatedItems.map((customer) => (
            <div key={customer.id} className="space-y-4 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">{customer.name}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Added {formatDate(customer.created_at)}
                  </p>
                </div>
                <Users className="h-5 w-5 text-slate-300" />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Mail className="h-4 w-4" />
                  <span>{customer.email ?? "No email address"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Phone className="h-4 w-4" />
                  <span>{customer.phone ?? "No phone number"}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/dashboard/customers/${customer.id}/edit`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  Edit
                </Link>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => setTarget(customer)}
                  disabled={pendingId === customer.id}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {pendingId === customer.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <ListPagination
          currentPage={page}
          totalPages={totalPages}
          itemLabel="customers"
          rangeLabel={`${Math.min((page - 1) * PAGE_SIZE + 1, processedItems.length)}-${Math.min(page * PAGE_SIZE, processedItems.length)} of ${processedItems.length}`}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        />
      </Card>

      <ConfirmDialog
        open={!!target}
        title={`Delete ${target?.name ?? "customer"}?`}
        description="This customer will be removed from your workspace. Existing quotes linked to this customer may block deletion depending on database rules."
        confirmLabel="Delete customer"
        pending={!!pendingId}
        onCancel={() => !pendingId && setTarget(null)}
        onConfirm={confirmDelete}
      />

      <InlineToast toast={toast} onClear={() => setToast(null)} />
    </>
  );
}
