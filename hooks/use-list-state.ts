"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

type SortDirection = "asc" | "desc";

export function useListState<TItem, TSortKey extends string>({
  items,
  pageSize,
  initialSortKey,
  initialSortDirection,
  matchesSearch,
  compare,
  resetKey
}: {
  items: TItem[];
  pageSize: number;
  initialSortKey: TSortKey;
  initialSortDirection: SortDirection;
  matchesSearch: (item: TItem, term: string) => boolean;
  compare: (
    a: TItem,
    b: TItem,
    sortKey: TSortKey,
    direction: SortDirection
  ) => number;
  resetKey?: unknown;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<TSortKey>(initialSortKey);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);
  const deferredSearch = useDeferredValue(search);

  const processedItems = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filtered = items.filter((item) => matchesSearch(item, term));
    return [...filtered].sort((a, b) => compare(a, b, sortKey, sortDirection));
  }, [items, deferredSearch, sortKey, sortDirection, matchesSearch, compare]);

  const totalPages = Math.max(1, Math.ceil(processedItems.length / pageSize));
  const paginatedItems = processedItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, resetKey, sortDirection, sortKey]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function toggleSort(nextKey: TSortKey, nextDirection?: SortDirection) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextDirection ?? "asc");
  }

  function resetSearch() {
    setSearch("");
  }

  return {
    search,
    setSearch,
    page,
    setPage,
    sortKey,
    sortDirection,
    toggleSort,
    processedItems,
    paginatedItems,
    totalPages,
    resetSearch
  };
}
