import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { buttonVariants } from "@/components/ui/button";

export function WorkflowHeader({
  title,
  subtitle,
  backHref,
  backLabel
}: {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className={buttonVariants({ variant: "secondary", className: "w-fit gap-2" })}
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <Topbar title={title} subtitle={subtitle} />
    </div>
  );
}
