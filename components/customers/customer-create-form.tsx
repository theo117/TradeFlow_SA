"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/app/dashboard/customers/actions";
import { Field } from "@/components/forms/field";
import { FormSection } from "@/components/forms/form-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CustomerCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const result = await createCustomer(new FormData(event.currentTarget));

      if (result.error) {
        setError(result.message);
        setPending(false);
        return;
      }

      router.push("/dashboard/customers?success=Customer%20created");
      router.refresh();
    } catch {
      setError("Unable to create customer. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}
      <FormSection
        title="Customer details"
        description="Store core contact information for the business or client."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field htmlFor="name" label="Name">
            <Input id="name" name="name" required />
          </Field>
          <Field htmlFor="email" label="Email">
            <Input id="email" name="email" type="email" />
          </Field>
          <Field htmlFor="phone" label="Phone">
            <Input id="phone" name="phone" />
          </Field>
          <Field htmlFor="whatsappPhone" label="WhatsApp phone">
            <Input id="whatsappPhone" name="whatsappPhone" />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm text-slate-600">
          <input
            type="checkbox"
            name="whatsappOptIn"
            className="h-4 w-4 rounded border-slate-300 text-ink focus:ring-ink"
          />
          Customer has opted in to WhatsApp updates
        </label>
        <Field htmlFor="address" label="Address">
          <Textarea id="address" name="address" />
        </Field>
      </FormSection>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving customer..." : "Save customer"}
        </Button>
        <Link
          href="/dashboard/customers"
          className={buttonVariants({ variant: "secondary" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
