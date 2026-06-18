import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/forms/field";
import { PendingButton } from "@/components/forms/pending-button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/app/(auth)/actions";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we will send a reset link if the account exists."
    >
      <form action={requestPasswordReset} className="space-y-4">
        <Field htmlFor="email" label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="owner@business.co.za"
            required
          />
        </Field>
        {params.sent ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            If that email exists, a password reset link has been sent.
          </p>
        ) : null}
        {params.error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {params.error}
          </p>
        ) : null}
        <PendingButton className="w-full" pendingLabel="Sending reset link...">
          Send reset link
        </PendingButton>
      </form>
      <p className="text-sm text-slate-500">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-700">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
