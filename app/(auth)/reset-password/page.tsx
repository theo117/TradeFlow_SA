import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/forms/field";
import { PendingButton } from "@/components/forms/pending-button";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/app/(auth)/actions";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use a strong password with at least 10 characters."
    >
      {params.token ? (
        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="token" value={params.token} />
          <Field htmlFor="password" label="New password">
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 10 characters"
              required
              minLength={10}
            />
          </Field>
          {params.error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {params.error}
            </p>
          ) : null}
          <PendingButton className="w-full" pendingLabel="Updating password...">
            Update password
          </PendingButton>
        </form>
      ) : (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          This reset link is missing a token. Please request a new link.
        </p>
      )}
      <p className="text-sm text-slate-500">
        Need a fresh link?{" "}
        <Link href="/forgot-password" className="font-medium text-brand-700">
          Request another reset
        </Link>
      </p>
    </AuthShell>
  );
}
