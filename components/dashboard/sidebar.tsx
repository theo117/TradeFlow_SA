"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Users
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { legalLinks } from "@/lib/legal";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/services", label: "Services", icon: BriefcaseBusiness },
  { href: "/dashboard/quotes", label: "Quotes", icon: FileText },
  { href: "/dashboard/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/dashboard/recurring", label: "Recurring", icon: CalendarClock },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard }
];

export function Sidebar({
  businessName,
  mobileOpen,
  onClose
}: {
  businessName: string;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const currentPath = usePathname();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col overflow-y-auto border-r border-slate-200 bg-[#0b1020] px-5 py-6 text-white transition duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.34em] text-brand-200">
              TradeFlow SA
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Operations Hub</h1>
            <p className="mt-2 text-sm text-slate-400">{businessName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 lg:hidden"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workspace</p>
          <p className="mt-2 text-2xl font-semibold text-white">Focus mode</p>
          <p className="mt-2 text-sm text-slate-300">
            Keep quotes moving, invoices collected, and customer records organised in one place.
          </p>
        </div>

        <nav className="space-y-1.5 pb-6">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? currentPath === href
                : currentPath.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition",
                  active
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full transition",
                    active ? "bg-brand-500" : "bg-transparent group-hover:bg-white/30"
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <nav className="flex flex-wrap gap-x-3 gap-y-2 px-1 text-xs text-slate-400">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
          <Button
            className="w-full justify-start gap-3 border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
            variant="ghost"
            type="submit"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
          </form>
        </div>
      </aside>
    </>
  );
}
