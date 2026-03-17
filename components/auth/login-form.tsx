"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({
  next,
  initialError
}: {
  next?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const redirectTo = next && next.startsWith("/") ? next : "/dashboard";

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo
    });

    if (!result || result.error) {
      setError("Invalid email or password");
      setPending(false);
      return;
    }

    router.push(result.url ?? redirectTo);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field htmlFor="email" label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="owner@business.co.za"
            required
          />
        </Field>
        <Field htmlFor="password" label="Password">
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 6 characters"
            required
          />
        </Field>
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Logging in..." : "Login"}
        </Button>
      </form>
      <p className="text-sm text-slate-500">
        New to TradeFlow SA?{" "}
        <Link href="/register" className="font-medium text-brand-700">
          Create an account
        </Link>
      </p>
    </>
  );
}
