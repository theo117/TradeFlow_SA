import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-hero-grid px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-16">
        <header className="flex items-center justify-between rounded-[2rem] bg-white/80 px-6 py-4 shadow-panel backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-brand-700">TradeFlow SA</p>
            <h1 className="text-xl font-semibold text-ink">Service Business Workspace</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
              Login
            </Link>
            <Link href="/register" className={buttonVariants({})}>
              Get started
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-10">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.35em] text-brand-700">
              Service business workflow
            </p>
            <h2 className="max-w-3xl text-5xl font-semibold leading-tight text-ink">
              Create quotes, manage customers, and keep your pipeline moving.
            </h2>
            <p className="max-w-2xl text-lg text-slate-600">
              Manage customers, services, quotes, and invoices in one workspace for small service businesses.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className={buttonVariants({})}>
                <span className="inline-flex items-center gap-2">
                  Create workspace
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
                Open dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
