import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; code?: string; next?: string; success?: string }>;
}) {
  const params = await searchParams;
  const error =
    params.code === "email_not_verified"
      ? "Please confirm your email address before logging in."
      : params.error;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Login to access your quotes, services, and customer records."
    >
      <LoginForm
        next={params.next}
        initialError={error}
        initialSuccess={params.success}
      />
    </AuthShell>
  );
}
