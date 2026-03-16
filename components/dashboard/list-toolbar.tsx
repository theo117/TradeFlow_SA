"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function ListToolbar({
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filterValue,
  filterOptions,
  onFilterChange,
  resultLabel,
  onReset
}: {
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  filterValue?: string;
  filterOptions?: Array<{ label: string; value: string }>;
  onFilterChange?: (value: string) => void;
  resultLabel: string;
  onReset: () => void;
}) {
  const hasActiveFilters =
    searchValue.trim().length > 0 || (filterValue !== undefined && filterValue !== "all");

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        {filterOptions && onFilterChange ? (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </div>
            <Select
              value={filterValue}
              onChange={(event) => onFilterChange(event.target.value)}
              className="min-w-40"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <p className="text-sm text-slate-500">{resultLabel}</p>
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" onClick={onReset}>
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
