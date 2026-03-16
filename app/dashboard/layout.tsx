import { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireBusiness } from "@/lib/auth";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const business = await requireBusiness();

  return (
    <DashboardShell businessName={business.name}>{children}</DashboardShell>
  );
}
