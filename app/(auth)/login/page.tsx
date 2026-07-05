import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; code?: string; next?: string; success?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;

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
