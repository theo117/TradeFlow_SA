"use client";

import { useRouter } from "next/navigation";

import { startTransition, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { InlineToastState } from "@/components/feedback/inline-toast";

type DeleteResult = {
  error: boolean;
  message: string;
};

export function useOptimisticDelete<TItem extends { id: string }>({
  items,
  setItems,
  deleteAction,
  formField
}: {
  items: TItem[];
  setItems: Dispatch<SetStateAction<TItem[]>>;
  deleteAction: (formData: FormData) => Promise<DeleteResult | undefined>;
  formField: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<TItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<InlineToastState>(null);

  async function confirmDelete() {
    if (!target) return;

    const snapshot = items;
    const nextItems = items.filter((item) => item.id !== target.id);

    setPendingId(target.id);
    startTransition(() => {
      setItems(nextItems);
    });

    try {
    const formData = new FormData();
    formData.set(formField, target.id);
    const result = await deleteAction(formData);

    if (result?.error) {
      setItems(snapshot);
      setToast({ kind: "error", message: result.message });
    } else {
      setToast({ kind: "success", message: result?.message ?? "Item deleted" });
    }

    
    setTarget(null);
    } catch {
      setItems(snapshot);
      setToast({ kind: "error", message: "Unable to confirm this request. Please try again." });
      router.refresh();
    } finally {
      setPendingId(null);
      setTarget(null);
    }
  }

  return {
    target,
    setTarget,
    pendingId,
    toast,
    setToast,
    confirmDelete
  };
}
