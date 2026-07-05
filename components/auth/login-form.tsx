"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({
  next,
  initialError,
  initialSuccess
}: {
  next?: string;
  initialError?: string;
  initialSuccess?: string;
}) {
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

    try {
      const result = await Promise.race([
        signIn("credentials", {
          email,
          password,
          redirect: false,
          redirectTo
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), 10000);
        })
      ]);

      if (!result || result.error || !result.ok) {
        setError(
          "The email or password does not match. Please check your password and try again."
        );
        setPending(false);
        return;
      }

      const session = await waitForSession();

      if (!session?.user?.email) {
        setError("Login did not create a session. Please refresh and try again.");
        setPending(false);
        return;
      }

      window.location.assign(result.url ?? redirectTo);
    } catch (error) {
      setError(
        error instanceof Error && error.message === "timeout"
          ? "Login request timed out. This usually means the live auth endpoint is failing."
          : "Login failed. Please try again."
      );
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field htmlFor="email" label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="owner@tradeflow.local"
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
        {!error && initialSuccess ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {initialSuccess}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Logging in..." : "Login"}
        </Button>
      </form>
    </>
  );
}

async function waitForSession() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await getSession();

    if (session) {
      return session;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}
