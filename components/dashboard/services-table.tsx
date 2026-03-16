"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { BriefcaseBusiness, Tag, Trash2 } from "lucide-react";
import { deleteService } from "@/app/dashboard/services/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ListToolbar } from "@/components/dashboard/list-toolbar";
import { SortHeader } from "@/components/dashboard/sort-header";
import { InlineToast } from "@/components/feedback/inline-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useListState } from "@/hooks/use-list-state";
import { useOptimisticDelete } from "@/hooks/use-optimistic-delete";
import type { Service } from "@/lib/types";
import { currency } from "@/lib/utils";

export function ServicesTable({ services }: { services: Service[] }) {
  const PAGE_SIZE = 6;
  const [rows, setRows] = useState(services);
  const matchesSearch = useCallback(
    (service: Service, term: string) =>
      term.length === 0 ||
      [service.name, service.description ?? "", String(service.price)]
        .join(" ")
        .toLowerCase()
        .includes(term),
    []
  );

  const compare = useCallback(
    (
      a: Service,
      b: Service,
      sortKey: "name" | "price",
      direction: "asc" | "desc"
    ) => {
      const factor = direction === "asc" ? 1 : -1;
      if (sortKey === "price") {
        return (Number(a.price) - Number(b.price)) * factor;
      }
      return a.name.localeCompare(b.name) * factor;
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
    initialSortKey: "name",
    initialSortDirection: "asc",
    matchesSearch,
    compare
  });
  const { target, setTarget, pendingId, toast, setToast, confirmDelete } =
    useOptimisticDelete({
      items: rows,
      setItems: setRows,
      deleteAction: deleteService,
      formField: "serviceId"
    });

  return (
    <>
      <Card className="overflow-hidden border-slate-200/80 bg-white/95 p-0">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Service catalogue
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">All services</h2>
        </div>

        <ListToolbar
          searchValue={search}
          searchPlaceholder="Search by service name, description, or price"
          onSearchChange={setSearch}
          resultLabel={`${processedItems.length} of ${rows.length} services`}
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
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">
                  <SortHeader
                    label="Price"
                    active={sortKey === "price"}
                    direction={sortDirection}
                    onClick={() => toggleSort("price", "desc")}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedItems.map((service) => (
                <tr key={service.id} className="transition hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <div className="font-medium text-ink">{service.name}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Billable item
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{service.description ?? "No description"}</td>
                  <td className="px-6 py-4 font-medium text-ink">{currency(Number(service.price))}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/services/${service.id}/edit`}
                        className={buttonVariants({ variant: "secondary" })}
                      >
                        Edit
                      </Link>
                      <Button
                        variant="danger"
                        type="button"
                        onClick={() => setTarget(service)}
                        disabled={pendingId === service.id}
                      >
                        {pendingId === service.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    {rows.length === 0
                      ? "No services left. Add a new service to rebuild your catalogue."
                      : "No services match your current search."}
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
                ? "No services left. Add a new service to rebuild your catalogue."
                : "No services match your current search."}
            </div>
          ) : null}
          {paginatedItems.map((service) => (
            <div key={service.id} className="space-y-4 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">{service.name}</p>
                  <p className="text-sm text-slate-500">
                    {service.description ?? "No description"}
                  </p>
                </div>
                <BriefcaseBusiness className="h-5 w-5 text-slate-300" />
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Tag className="h-4 w-4" />
                <span className="font-medium text-ink">{currency(Number(service.price))}</span>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/dashboard/services/${service.id}/edit`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  Edit
                </Link>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => setTarget(service)}
                  disabled={pendingId === service.id}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {pendingId === service.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <ListPagination
          currentPage={page}
          totalPages={totalPages}
          itemLabel="services"
          rangeLabel={`${Math.min((page - 1) * PAGE_SIZE + 1, processedItems.length)}-${Math.min(page * PAGE_SIZE, processedItems.length)} of ${processedItems.length}`}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        />
      </Card>

      <ConfirmDialog
        open={!!target}
        title={`Delete ${target?.name ?? "service"}?`}
        description="This service will be removed from your catalogue. Existing quote items linked to this service may block deletion depending on database rules."
        confirmLabel="Delete service"
        pending={!!pendingId}
        onCancel={() => !pendingId && setTarget(null)}
        onConfirm={confirmDelete}
      />

      <InlineToast toast={toast} onClear={() => setToast(null)} />
    </>
  );
}
