import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  variant = "draft"
}: {
  children: ReactNode;
  variant?: "draft" | "sent" | "accepted" | "paid" | "overdue";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        variant === "paid"
          ? "bg-emerald-100 text-emerald-700"
          : variant === "accepted"
            ? "bg-emerald-100 text-emerald-700"
          : variant === "sent"
            ? "bg-sky-100 text-sky-700"
            : variant === "overdue"
              ? "bg-rose-100 text-rose-700"
              : "bg-amber-100 text-amber-800"
      )}
    >
      {children}
    </span>
  );
}
