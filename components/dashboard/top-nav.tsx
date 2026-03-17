"use client";

import { Bell, LogOut, Menu, Search } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function TopNav({
  businessName,
  onOpenSidebar
}: {
  businessName: string;
  onOpenSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-10 rounded-xl p-0 lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="hidden min-[480px]:flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <span>Search customers or quotes</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-ink"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          <form action={logout}>
            <Button
              type="submit"
              variant="secondary"
              className="gap-2 rounded-xl"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </form>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="hidden text-right sm:block">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Workspace</p>
              <p className="text-sm font-medium text-ink">{businessName}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-white">
              {businessName.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
