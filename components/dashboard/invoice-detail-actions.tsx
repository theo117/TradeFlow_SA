"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deleteInvoice,
  voidInvoice,
  recordInvoiceReminder,
  revokeInvoicePublicLinks,
  updateInvoiceStatus
} from "@/app/dashboard/invoices/actions";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmailShareButton } from "@/components/dashboard/email-share-button";
import { InlineToast, type InlineToastState } from "@/components/feedback/inline-toast";
import { WhatsAppShareButton } from "@/components/dashboard/whatsapp-share-button";
import { Button, buttonVariants } from "@/components/ui/button";

export function InvoiceDetailActions({
  invoiceId,
  status,
  pdfHref,
  emailHref,
  whatsappHref,
  reminderEmailHref,
  reminderWhatsappHref
}: {
  invoiceId: string;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
  pdfHref: string;
  emailHref?: string | null;
  whatsappHref?: string | null;
  reminderEmailHref?: string | null;
  reminderWhatsappHref?: string | null;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pending, setPending] = useState<
    "sent" | "paid" | "email" | "whatsapp" | "revoke" | "delete" | "void" | null
  >(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toast, setToast] = useState<InlineToastState>(null);

  async function handleStatus(nextStatus: "sent" | "paid") {
    const snapshot = currentStatus;
    setPending(nextStatus);
    setCurrentStatus(nextStatus);

    const result = await updateInvoiceStatus(invoiceId, nextStatus);

    if (result?.error) {
      setCurrentStatus(snapshot);
      setToast({ kind: "error", message: result.message });
    } else {
      setToast({ kind: "success", message: result.message });
      router.refresh();
    }

    setPending(null);
  }

  async function handleReminder(
    channel: "email" | "whatsapp",
    href?: string | null
  ) {
    if (channel === "email" && !href) {
      return;
    }

    setPending(channel);
    const result = await recordInvoiceReminder(invoiceId, channel);

    if (result?.error) {
      setToast({ kind: "error", message: result.message });
      setPending(null);
      return;
    }

    setToast({ kind: "success", message: result.message });
    router.refresh();

    if (channel === "whatsapp" && result?.delivery === "manual" && href) {
      window.open(href, "_blank", "noreferrer");
    } else if (channel === "email" && href) {
      window.location.assign(href);
    }

    setPending(null);
  }

  async function handleRevokeLinks() {
    setPending("revoke");
    const result = await revokeInvoicePublicLinks(invoiceId);

    if (result?.error) {
      setToast({ kind: "error", message: result.message });
    } else {
      setToast({ kind: "success", message: result.message });
      router.refresh();
    }

    setPending(null);
  }

  async function handleDelete() {
    const shouldVoid = currentStatus === "sent" || currentStatus === "overdue";
    setPending(shouldVoid ? "void" : "delete");
    try {
      const result = await (shouldVoid ? voidInvoice(invoiceId) : deleteInvoice(invoiceId));
      if (result.error) {
        setToast({ kind: "error", message: result.message });
        return;
      }
      if (shouldVoid) {
        setCurrentStatus("void");
        setToast({ kind: "success", message: result.message });
      } else {
        router.push("/dashboard/invoices?success=Invoice%20deleted");
      }
      router.refresh();
    } catch {
      setToast({ kind: "error", message: "Unable to confirm the result. Refresh or retry the operation." });
    } finally {
      setPending(null);
      setConfirmDeleteOpen(false);
    }
  }

  const primaryEmailHref =
    currentStatus === "draft" ? emailHref : reminderEmailHref ?? emailHref;
  const primaryWhatsappHref =
    currentStatus === "draft" ? whatsappHref : reminderWhatsappHref ?? whatsappHref;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {currentStatus === "draft" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleStatus("sent")}
            disabled={pending !== null}
          >
            {pending === "sent" ? "Updating..." : "Mark sent"}
          </Button>
        ) : null}
        {currentStatus !== "paid" && currentStatus !== "void" ? (
          <Button
            type="button"
            onClick={() => handleStatus("paid")}
            disabled={pending !== null}
          >
            {pending === "paid" ? "Updating..." : "Mark paid"}
          </Button>
        ) : null}
        <Link href={pdfHref} className={buttonVariants({ variant: "secondary" })}>
          Download PDF
        </Link>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={handleRevokeLinks}
        >
          {pending === "revoke" ? "Revoking..." : "Revoke public links"}
        </Button>
        {currentStatus === "draft" || currentStatus === "sent" || currentStatus === "overdue" ? (
          <Button
            type="button"
            variant="danger"
            disabled={pending !== null}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            {currentStatus === "draft" ? "Delete invoice" : "Void invoice"}
          </Button>
        ) : null}
        {currentStatus !== "void" ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={pending !== null || !primaryEmailHref}
              onClick={() => handleReminder("email", primaryEmailHref)}
            >
              {pending === "email"
                ? "Preparing..."
                : currentStatus === "draft"
                  ? "Send via Email"
                  : "Resend Email"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending !== null}
              onClick={() => handleReminder("whatsapp", primaryWhatsappHref)}
            >
              {pending === "whatsapp"
                ? "Preparing..."
                : currentStatus === "draft"
                  ? "Send via WhatsApp"
                  : "Send Reminder"}
            </Button>
            <EmailShareButton
              href={emailHref}
              label={currentStatus === "draft" ? "Email draft" : "Open email draft"}
              className="hidden"
            />
            <WhatsAppShareButton href={whatsappHref} className="hidden" />
          </>
        ) : null}
        <Link
          href="/dashboard/invoices"
          className={buttonVariants({ variant: "secondary" })}
        >
          Back to invoices
        </Link>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={currentStatus === "draft" ? "Delete this invoice?" : "Void this invoice?"}
        description={currentStatus === "draft"
          ? "This permanently removes the draft, its line items, and active public links. The source quote will remain available."
          : "This preserves the invoice and its history, but marks it void and not payable. This cannot be undone here."}
        confirmLabel={currentStatus === "draft" ? "Delete invoice" : "Void invoice"}
        pendingLabel={currentStatus === "draft" ? "Deleting..." : "Voiding..."}
        pending={pending === "delete" || pending === "void"}
        onCancel={() => pending === null && setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <InlineToast toast={toast} onClear={() => setToast(null)} />
    </>
  );
}
