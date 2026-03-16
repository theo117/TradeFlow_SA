"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { convertQuoteToInvoice } from "@/app/dashboard/invoices/actions";
import { deleteQuote, updateQuoteStatus } from "@/app/dashboard/quotes/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { PendingButton } from "@/components/forms/pending-button";
import { InlineToast, type InlineToastState } from "@/components/feedback/inline-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuoteDetailActions({
  quoteId,
  status,
  defaultDueDate,
  existingInvoice
}: {
  quoteId: string;
  status: "draft" | "sent";
  defaultDueDate: string;
  existingInvoice?: {
    id: string;
    invoice_number: string;
    status: "draft" | "sent" | "paid" | "overdue";
  } | null;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pending, setPending] = useState<"status" | "delete" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<InlineToastState>(null);

  async function handleStatus() {
    const nextStatus = currentStatus === "draft" ? "sent" : "draft";
    setPending("status");
    setCurrentStatus(nextStatus);

    const result = await updateQuoteStatus(quoteId, nextStatus);

    if (result?.error) {
      setCurrentStatus(currentStatus);
      setToast({ kind: "error", message: result.message });
    } else {
      setToast({
        kind: "success",
        message: result?.message ?? `Quote marked as ${nextStatus}`
      });
      router.refresh();
    }

    setPending(null);
  }

  async function handleDelete() {
    setPending("delete");
    const formData = new FormData();
    formData.set("quoteId", quoteId);
    const result = await deleteQuote(formData);

    if (result?.error) {
      setToast({ kind: "error", message: result.message });
      setPending(null);
      setConfirmOpen(false);
      return;
    }

    router.push("/dashboard/quotes?success=Quote%20deleted");
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleStatus}
            disabled={pending !== null}
          >
            {pending === "status"
              ? "Updating..."
              : currentStatus === "draft"
                ? "Mark as sent"
                : "Move to draft"}
          </Button>
          <Link
            href="/dashboard/quotes"
            className={buttonVariants({ variant: "secondary" })}
          >
            Back to quotes
          </Link>
          {existingInvoice ? (
            <Link
              href={`/dashboard/invoices/${existingInvoice.id}`}
              className={buttonVariants({})}
            >
              View invoice
            </Link>
          ) : (
            <form action={convertQuoteToInvoice} className="flex flex-wrap gap-2">
              <input type="hidden" name="quoteId" value={quoteId} />
              <input
                type="hidden"
                name="redirectTo"
                value={`/dashboard/quotes/${quoteId}`}
              />
              <Input
                type="date"
                name="dueDate"
                defaultValue={defaultDueDate}
                className="min-w-[11rem]"
                aria-label="Invoice due date"
              />
              <PendingButton pendingLabel="Creating invoice...">
                Convert to invoice
              </PendingButton>
            </form>
          )}
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirmOpen(true)}
            disabled={pending !== null}
          >
            Delete quote
          </Button>
        </div>

        {existingInvoice ? (
          <p className="text-sm text-slate-500">
            Quote already converted to {existingInvoice.invoice_number}.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Set a due date and convert this quote into a customer-facing invoice.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete quote ${quoteId.slice(0, 8).toUpperCase()}?`}
        description="This quote and all linked quote items will be removed permanently."
        confirmLabel="Delete quote"
        pending={pending === "delete"}
        onCancel={() => pending !== "delete" && setConfirmOpen(false)}
        onConfirm={handleDelete}
      />

      <InlineToast toast={toast} onClear={() => setToast(null)} />
    </>
  );
}
