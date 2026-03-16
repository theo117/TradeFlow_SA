import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const features = [
  "Supabase authentication with protected dashboard routes",
  "Customer and service CRUD for small teams",
  "Quote creation with item totals and customer lookup"
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-hero-grid px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-16">
        <header className="flex items-center justify-between rounded-[2rem] bg-white/80 px-6 py-4 shadow-panel backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-brand-700">TradeFlow SA</p>
            <h1 className="text-xl font-semibold text-ink">SaaS MVP Foundation</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
              Login
            </Link>
            <Link href="/register" className={buttonVariants({})}>
              Start free
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.35em] text-brand-700">
              Service business workflow
            </p>
            <h2 className="max-w-3xl text-5xl font-semibold leading-tight text-ink">
              Create quotes, manage customers, and keep your pipeline moving.
            </h2>
            <p className="max-w-2xl text-lg text-slate-600">
              Week 1 ships the core operating layer: auth, dashboard metrics, customer records, services, and quotes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className={buttonVariants({})}>
                <span className="inline-flex items-center gap-2">
                  Launch dashboard
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
                View app routes
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] bg-ink p-8 text-white shadow-panel">
            <p className="text-sm uppercase tracking-[0.3em] text-brand-200">Included in Week 1</p>
            <div className="mt-6 space-y-4">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-200" />
                  <p className="text-sm text-slate-100">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
