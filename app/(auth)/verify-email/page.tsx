import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { recoveryErrorMessage } from "@/lib/auth-messages";
import { confirmEmail, resendEmailVerification } from "../actions";

export default async function VerifyEmailPage({ searchParams }: {
  searchParams: Promise<{ token?: string; sent?: string; code?: string }>;
}) {
  const params = await searchParams;
  const validToken = typeof params.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(params.token);
  const error = recoveryErrorMessage(params.code ?? (params.token && !validToken ? "invalid_token" : undefined));
  return <AuthShell title="Verify your email" subtitle="Confirm your email address before logging in.">
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    {params.sent === "1" ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">If an account needs verification, a confirmation link will be sent when email delivery is available.</p> : null}
    {validToken ? <form action={confirmEmail} className="space-y-4">
      <input type="hidden" name="token" value={params.token} />
      <Button type="submit" className="w-full">Verify email</Button>
    </form> : <form action={resendEmailVerification} className="space-y-4">
      <Field htmlFor="email" label="Email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Button type="submit" className="w-full">Send verification link</Button>
    </form>}
    <Link href="/login" className="text-sm text-brand-700">Back to login</Link>
  </AuthShell>;
}
