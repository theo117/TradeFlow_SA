"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateInvoiceStatus } from "@/app/dashboard/invoices/actions";
import { EmailShareButton } from "@/components/dashboard/email-share-button";
import { InlineToast, type InlineToastState } from "@/components/feedback/inline-toast";
import { WhatsAppShareButton } from "@/components/dashboard/whatsapp-share-button";
import { Button, buttonVariants } from "@/components/ui/button";

export function InvoiceDetailActions({
  invoiceId,
  status,
  pdfHref,
  emailHref,
  whatsappHref
}: {
  invoiceId: string;
  status: "draft" | "sent" | "paid" | "overdue";
  pdfHref: string;
  emailHref?: string | null;
  whatsappHref?: string | null;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pending, setPending] = useState<"sent" | "paid" | null>(null);
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
        <EmailShareButton href={emailHref} />
        <WhatsAppShareButton href={whatsappHref} />
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
