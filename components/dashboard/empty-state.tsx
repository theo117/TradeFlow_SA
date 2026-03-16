import Link from "next/link";
import { Inbox } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  ctaHref,
  ctaLabel
}: {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/85 px-6 py-14 text-center shadow-sm">
      <div className="mx-auto max-w-md space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
          <Inbox className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
        <Link href={ctaHref} className={buttonVariants({ className: "mt-2" })}>
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
