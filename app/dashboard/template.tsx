import type { ReactNode } from "react";
import { QueryToast } from "@/components/feedback/query-toast";

export default function DashboardTemplate({
  children
}: {
  children: ReactNode;
}) {
  return (
    <>
      <QueryToast />
      {children}
    </>
  );
}
