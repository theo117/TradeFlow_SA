import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/forms/field";
import { PendingButton } from "@/components/forms/pending-button";
import { Input } from "@/components/ui/input";
import { login } from "@/app/(auth)/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Login to access your quotes, services, and customer records."
    >
      <form action={login} className="space-y-4">
        <Field htmlFor="email" label="Email">
          <Input id="email" name="email" type="email" placeholder="owner@business.co.za" required />
        </Field>
        <Field htmlFor="password" label="Password">
          <Input id="password" name="password" type="password" placeholder="••••••••" required />
        </Field>
        {params.error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{params.error}</p>
        ) : null}
        <PendingButton className="w-full" pendingLabel="Logging in...">
          Login
        </PendingButton>
      </form>
      <p className="text-sm text-slate-500">
        New to TradeFlow SA?{" "}
        <Link href="/register" className="font-medium text-brand-700">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
