"use client";

import { ReactNode, useState } from "react";
import { TopNav } from "@/components/dashboard/top-nav";
import { Sidebar } from "@/components/dashboard/sidebar";

export function DashboardShell({
  businessName,
  children
}: {
  businessName: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-ink">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-brand-200/30 blur-3xl" />
        <div className="absolute right-0 top-24 h-[28rem] w-[28rem] rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_70%)]" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <Sidebar
          businessName={businessName}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav
            businessName={businessName}
            onOpenSidebar={() => setMobileOpen(true)}
          />
          <main className="flex-1 px-4 pb-6 pt-4 sm:px-6 lg:px-8 lg:pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
