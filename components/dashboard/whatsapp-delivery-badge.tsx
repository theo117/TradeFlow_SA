import { cn } from "@/lib/utils";
import type { WhatsappDeliveryState } from "@/lib/whatsapp";

export function WhatsAppDeliveryBadge({
  status
}: {
  status?: WhatsappDeliveryState | null;
}) {
  if (!status) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "read"
          ? "bg-emerald-100 text-emerald-700"
          : status === "delivered"
            ? "bg-sky-100 text-sky-700"
            : status === "sent"
              ? "bg-cyan-100 text-cyan-700"
              : status === "failed"
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-800"
      )}
    >
      WhatsApp {status}
    </span>
  );
}
