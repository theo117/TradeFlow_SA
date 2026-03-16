"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type InlineToastState = {
  kind: "success" | "error";
  message: string;
} | null;

export function InlineToast({
  toast,
  onClear
}: {
  toast: InlineToastState;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(onClear, 2800);
    return () => window.clearTimeout(timer);
  }, [toast, onClear]);

  if (!toast) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] w-[min(360px,calc(100vw-2rem))]">
      <div
        className={cn(
          "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl",
          toast.kind === "success"
            ? "border-emerald-200 bg-white text-slate-900"
            : "border-rose-200 bg-white text-slate-900"
        )}
      >
        <div
          className={cn(
            "mt-0.5 rounded-full p-1",
            toast.kind === "success"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-600"
          )}
        >
          {toast.kind === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {toast.kind === "success" ? "Success" : "Delete failed"}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}
