"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ListPagination({
  currentPage,
  totalPages,
  itemLabel,
  rangeLabel,
  onPrevious,
  onNext
}: {
  currentPage: number;
  totalPages: number;
  itemLabel: string;
  rangeLabel: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        {rangeLabel} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">
          Page {currentPage} of {totalPages}
        </span>
        <Button type="button" variant="secondary" onClick={onPrevious} disabled={currentPage === 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onNext}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
