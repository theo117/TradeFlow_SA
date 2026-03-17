"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  recordInvoiceReminder,
  updateInvoiceStatus
} from "@/app/dashboard/invoices/actions";
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
  status: "draft" | "sent" | "paid" | "overdue";
  pdfHref: string;
  emailHref?: string | null;
  whatsappHref?: string | null;
  reminderEmailHref?: string | null;
  reminderWhatsappHref?: string | null;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pending, setPending] = useState<"sent" | "paid" | "email" | "whatsapp" | null>(null);
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
    if (!href) {
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

    if (channel === "whatsapp") {
      window.open(href, "_blank", "noreferrer");
    } else {
      window.location.assign(href);
    }

    setPending(null);
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
        {currentStatus !== "paid" ? (
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
          disabled={pending !== null || !primaryWhatsappHref}
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
        <Link
          href="/dashboard/invoices"
          className={buttonVariants({ variant: "secondary" })}
        >
          Back to invoices
        </Link>
      </div>

      <InlineToast toast={toast} onClear={() => setToast(null)} />
    </>
  );
}
