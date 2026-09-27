import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { recoveryErrorMessage } from "@/lib/auth-messages";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({ searchParams }: {
  searchParams: Promise<{ sent?: string; code?: string }>;
}) {
  const params = await searchParams;
  const error = recoveryErrorMessage(params.code);
  return <AuthShell title="Forgot password" subtitle="Request a link to reset your password.">
    {params.sent === "1" ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">If an account matches that email, a password reset link will be sent when email delivery is available.</p> : null}
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    <form action={requestPasswordReset} className="space-y-4">
      <Field htmlFor="email" label="Email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Button type="submit" className="w-full">Send reset link</Button>
    </form>
    <Link href="/login" className="text-sm text-brand-700">Back to login</Link>
  </AuthShell>;
}
