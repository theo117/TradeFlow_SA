import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/forms/field";
import { PendingButton } from "@/components/forms/pending-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resendEmailVerification } from "@/app/(auth)/actions";
import { verifyEmailToken } from "@/lib/email-verification";

function getMessage({
  sent,
  email,
  result
}: {
  sent?: string;
  email?: string;
  result?: Awaited<ReturnType<typeof verifyEmailToken>>;
}) {
  if (result?.ok) {
    return {
      title: "Email confirmed",
      subtitle: "Your account is ready. You can log in now.",
      tone: "success" as const
    };
  }

  if (result?.reason === "expired") {
    return {
      title: "Confirmation link expired",
      subtitle: "Please register again or ask for a fresh confirmation link.",
      tone: "error" as const
    };
  }

  if (result?.reason === "invalid") {
    return {
      title: "Confirmation link is invalid",
      subtitle: "Please check that you opened the latest confirmation email.",
      tone: "error" as const
    };
  }

  if (sent) {
    return {
      title: "Check your email",
      subtitle: `We sent a confirmation link${email ? ` to ${email}` : ""}.`,
      tone: "info" as const
    };
  }

  return {
    title: "Confirm your email",
    subtitle: "Open the confirmation link we sent after registration.",
    tone: "info" as const
  };
}

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{
    token?: string;
    sent?: string;
    email?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const result = params.token
    ? await verifyEmailToken(params.token)
    : undefined;
  const message = getMessage({
    sent: params.sent,
    email: params.email,
    result
  });
  const panelClass =
    message.tone === "error"
      ? "rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"
      : "rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700";

  return (
    <AuthShell title={message.title} subtitle={message.subtitle}>
      <div className="space-y-4">
        <p className={panelClass}>{message.subtitle}</p>
        {params.error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {params.error}
          </p>
        ) : null}
        {!result?.ok ? (
          <form action={resendEmailVerification} className="space-y-4">
            <Field htmlFor="email" label="Resend confirmation email">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="owner@business.co.za"
                defaultValue={params.email ?? ""}
                required
              />
            </Field>
            <PendingButton
              className="w-full"
              variant="secondary"
              pendingLabel="Sending confirmation..."
            >
              Resend confirmation
            </PendingButton>
          </form>
        ) : null}
        <Link href="/login" className={buttonVariants({ className: "w-full" })}>
          Go to login
        </Link>
      </div>
    </AuthShell>
  );
}
