"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PendingButton } from "@/components/forms/pending-button";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currency } from "@/lib/utils";
import type { Customer, Service } from "@/lib/types";

type QuoteBuilderFormProps = {
  customers: Customer[];
  services: Service[];
  action: (formData: FormData) => void;
};

type ItemRow = {
  rowId: string;
  service_id: string;
  quantity: number;
};

export function QuoteBuilderForm({
  customers,
  services,
  action
}: QuoteBuilderFormProps) {
  const [items, setItems] = useState<ItemRow[]>([
    { rowId: crypto.randomUUID(), service_id: services[0]?.id ?? "", quantity: 1 }
  ]);

  const calculatedItems = useMemo(
    () =>
      items
        .map((item) => {
          const service = services.find((entry) => entry.id === item.service_id);
          if (!service) return null;

          return {
            service_id: service.id,
            quantity: item.quantity,
            price: Number(service.price),
            subtotal: Number(service.price) * item.quantity
          };
        })
        .filter(Boolean),
    [items, services]
  );

  const total = calculatedItems.reduce((sum, item) => sum + (item?.subtotal ?? 0), 0);

  function addRow() {
    setItems((current) => [
      ...current,
      { rowId: crypto.randomUUID(), service_id: services[0]?.id ?? "", quantity: 1 }
    ]);
  }

  function updateRow(rowId: string, patch: Partial<ItemRow>) {
    setItems((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  }

  function removeRow(rowId: string) {
    setItems((current) => current.filter((row) => row.rowId !== rowId));
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(calculatedItems)} />

      <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Quote setup
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Customer and status</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field htmlFor="customerId" label="Customer">
            <Select id="customerId" name="customerId" required>
              <option value="">Select a customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="status" label="Status">
            <Select id="status" name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Line items
            </p>
            <h3 className="mt-1 text-xl font-semibold text-ink">Quote items</h3>
            <p className="text-sm text-slate-500">Add services and quantities to calculate the quote total.</p>
          </div>
          <Button onClick={addRow} type="button" variant="secondary">
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => {
            const selectedService = services.find((service) => service.id === item.service_id);
            const subtotal = (selectedService?.price ?? 0) * item.quantity;

            return (
              <div
                key={item.rowId}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.3fr_0.5fr_0.5fr_auto]"
              >
                <Field htmlFor={`service-${index}`} label="Service">
                  <Select
                    id={`service-${index}`}
                    value={item.service_id}
                    onChange={(event) =>
                      updateRow(item.rowId, { service_id: event.target.value })
                    }
                    required
                  >
                    <option value="">Select a service</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field htmlFor={`qty-${index}`} label="Qty">
                  <Input
                    id={`qty-${index}`}
                    min={1}
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      updateRow(item.rowId, {
                        quantity: Math.max(1, Number(event.target.value) || 1)
                      })
                    }
                    required
                  />
                </Field>

                <Field htmlFor={`price-${index}`} label="Price">
                  <Input
                    id={`price-${index}`}
                    readOnly
                    value={selectedService ? currency(Number(selectedService.price)) : "R0.00"}
                  />
                </Field>

                <div className="flex items-end justify-between gap-3">
                  <div className="pb-2 text-sm font-medium text-ink">{currency(subtotal)}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeRow(item.rowId)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Notes
          </p>
          <h3 className="mt-1 text-xl font-semibold text-ink">Internal notes</h3>
        </div>
        <Field htmlFor="notes" label="Internal notes">
          <Textarea id="notes" name="notes" placeholder="Optional notes for your team" />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-[28px] bg-[linear-gradient(135deg,#0b1020_0%,#18243f_55%,#1b3558_100%)] px-6 py-5 text-white shadow-sm">
        <div>
          <p className="text-sm text-slate-300">Quote total</p>
          <p className="text-3xl font-semibold">{currency(total)}</p>
        </div>
        <PendingButton pendingLabel="Saving quote...">Save quote</PendingButton>
      </div>
    </form>
  );
}
