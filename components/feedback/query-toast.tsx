"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function QueryToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const toast = useMemo(() => {
    const success = params.get("success");
    const error = params.get("error");

    if (error) return { kind: "error" as const, message: error };
    if (success) return { kind: "success" as const, message: success };
    return null;
  }, [params]);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      const next = new URLSearchParams(params.toString());
      next.delete("success");
      next.delete("error");
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, {
        scroll: false
      });
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast, pathname, router, params]);

  if (!toast || !visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[60] w-[min(380px,calc(100vw-2rem))]">
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
            {toast.kind === "success" ? "Success" : "Action failed"}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}
