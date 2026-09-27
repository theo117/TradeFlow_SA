import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { recoveryErrorMessage } from "@/lib/auth-messages";
import { resetPassword } from "../actions";

export default async function ResetPasswordPage({ searchParams }: {
  searchParams: Promise<{ token?: string; code?: string }>;
}) {
  const params = await searchParams;
  const validToken = typeof params.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(params.token);
  const error = recoveryErrorMessage(params.code ?? (!validToken ? "invalid_token" : undefined));
  return <AuthShell title="Reset password" subtitle="Choose a new password for your account.">
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    {validToken ? <form action={resetPassword} className="space-y-4">
      <input type="hidden" name="token" value={params.token} />
      <Field htmlFor="password" label="New password"><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
      <Button type="submit" className="w-full">Reset password</Button>
    </form> : null}
    <div className="flex gap-4 text-sm text-brand-700"><Link href="/forgot-password">Request a new link</Link><Link href="/login">Back to login</Link></div>
  </AuthShell>;
}
