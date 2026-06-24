import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Field } from "@/components/forms/field";
import { PendingButton } from "@/components/forms/pending-button";
import { Input } from "@/components/ui/input";
import { register } from "@/app/(auth)/actions";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Set up your business account and start sending quotes."
    >
      <GoogleAuthButton label="Sign up with Google" />
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        Or use email
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <form action={register} className="space-y-4">
        <Field htmlFor="businessName" label="Business name">
          <Input id="businessName" name="businessName" placeholder="TradeFlow Electrical" required />
        </Field>
        <Field htmlFor="email" label="Email">
          <Input id="email" name="email" type="email" placeholder="owner@business.co.za" required />
        </Field>
        <Field htmlFor="password" label="Password">
          <Input id="password" name="password" type="password" placeholder="At least 10 characters" required />
        </Field>
        {params.error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{params.error}</p>
        ) : null}
        <PendingButton className="w-full" pendingLabel="Creating account...">
          Register
        </PendingButton>
      </form>
      <p className="text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700">
          Login
        </Link>
      </p>
    </AuthShell>
  );
}
