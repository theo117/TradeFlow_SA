"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { convertQuoteToInvoice } from "@/app/dashboard/invoices/actions";
import {
  deleteQuote,
  revokeQuotePublicLinks,
  sendQuoteViaWhatsapp,
  updateQuoteStatus
} from "@/app/dashboard/quotes/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmailShareButton } from "@/components/dashboard/email-share-button";
import { WhatsAppShareButton } from "@/components/dashboard/whatsapp-share-button";
import { PendingButton } from "@/components/forms/pending-button";
import { InlineToast, type InlineToastState } from "@/components/feedback/inline-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuoteDetailActions({
  quoteId,
  status,
  defaultDueDate,
  emailHref,
  whatsappHref,
  publicHref,
  existingInvoice
}: {
  quoteId: string;
  status: "draft" | "sent" | "accepted";
  defaultDueDate: string;
  emailHref?: string | null;
  whatsappHref?: string | null;
  publicHref: string;
  existingInvoice?: {
    id: string;
    invoice_number: string;
    status: "draft" | "sent" | "paid" | "overdue";
  } | null;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pending, setPending] = useState<
    "status" | "delete" | "whatsapp" | "revoke" | null
  >(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<InlineToastState>(null);

  async function handleStatus() {
    if (currentStatus === "accepted") {
      return;
    }

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

  async function handleWhatsapp() {
    setPending("whatsapp");
    const result = await sendQuoteViaWhatsapp(quoteId);

    if (result?.error) {
      setToast({ kind: "error", message: result.message });
      setPending(null);
      return;
    }

    setToast({ kind: "success", message: result.message });
    router.refresh();

    if (result?.delivery === "manual" && whatsappHref) {
      window.open(whatsappHref, "_blank", "noreferrer");
    }

    setPending(null);
  }

  async function handleRevokeLinks() {
    setPending("revoke");
    const result = await revokeQuotePublicLinks(quoteId);

    if (result?.error) {
      setToast({ kind: "error", message: result.message });
    } else {
      setToast({ kind: "success", message: result.message });
      router.refresh();
    }

    setPending(null);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {currentStatus !== "accepted" ? (
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
          ) : null}
          <Link
            href="/dashboard/quotes"
            className={buttonVariants({ variant: "secondary" })}
          >
            Back to quotes
          </Link>
          <Link
            href={`/api/quotes/${quoteId}/pdf`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Download PDF
          </Link>
          <Link
            href={publicHref}
            className={buttonVariants({ variant: "secondary" })}
          >
            Open public quote
          </Link>
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={handleRevokeLinks}
          >
            {pending === "revoke" ? "Revoking..." : "Revoke public links"}
          </Button>
          <EmailShareButton href={emailHref} />
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={handleWhatsapp}
          >
            {pending === "whatsapp" ? "Sending..." : "Send via WhatsApp"}
          </Button>
          <WhatsAppShareButton href={whatsappHref} className="hidden" />
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
        ) : currentStatus === "accepted" ? (
          <p className="text-sm text-emerald-700">
            This quote has been accepted and is ready to convert into an invoice.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Send the public quote link to your customer, then convert it into an invoice once accepted.
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
