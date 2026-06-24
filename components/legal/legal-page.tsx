import Link from "next/link";
import type { ReactNode } from "react";
import { legalBusiness, legalLinks } from "@/lib/legal";

export function LegalPage({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-hero-grid px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">
            {legalBusiness.productName}
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm text-slate-500">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-brand-700">
                {link.label}
              </Link>
            ))}
          </nav>
        </header>

        <section className="py-10">
          <p className="text-sm text-slate-500">Effective date: {legalBusiness.effectiveDate}</p>
          <h1 className="mt-3 text-4xl font-semibold text-ink">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {description}
          </p>
        </section>

        <article className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </article>

        <footer className="py-6 text-center text-xs uppercase tracking-[0.24em] text-slate-400">
          pwoered by teodor dev tech
        </footer>
      </div>
    </main>
  );
}

export function LegalSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}
