import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-hero-grid px-4">
      <div className="space-y-4 rounded-[2rem] bg-white p-10 text-center shadow-panel">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Not Found</p>
        <h1 className="text-3xl font-semibold text-ink">This page does not exist.</h1>
        <Link href="/dashboard" className={buttonVariants({})}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
