"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = "left"
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 font-medium transition hover:text-ink",
        align === "right" ? "ml-auto" : ""
      )}
    >
      {label}
      <Icon className="h-4 w-4" />
    </button>
  );
}
