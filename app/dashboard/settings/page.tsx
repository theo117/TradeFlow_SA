import Image from "next/image";
import { updateBusinessProfile } from "@/app/dashboard/settings/actions";
import { WorkflowHeader } from "@/components/dashboard/workflow-header";
import { Field } from "@/components/forms/field";
import { FormSection } from "@/components/forms/form-section";
import { PendingButton } from "@/components/forms/pending-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireBusiness } from "@/lib/auth";

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const business = await requireBusiness();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title="Business settings"
        subtitle="Update your company details, payment instructions, and logo."
        backHref="/dashboard"
        backLabel="Back to dashboard"
      />

      <form action={updateBusinessProfile} className="space-y-4">
        {params.success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {params.success}
          </div>
        ) : null}
        {params.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {params.error}
          </div>
        ) : null}

        <FormSection
          title="Business profile"
          description="These details appear on invoices and can be used on quote documents."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field htmlFor="name" label="Business name">
              <Input id="name" name="name" defaultValue={business.name} required />
            </Field>
            <Field htmlFor="email" label="Business email">
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={business.email ?? ""}
              />
            </Field>
            <Field htmlFor="phone" label="Business phone">
              <Input id="phone" name="phone" defaultValue={business.phone ?? ""} />
            </Field>
            <Field htmlFor="logo" label="Company logo">
              <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg" />
            </Field>
          </div>
          <Field htmlFor="address" label="Business address">
            <Textarea id="address" name="address" defaultValue={business.address ?? ""} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field htmlFor="registrationNumber" label="Registration number">
              <Input
                id="registrationNumber"
                name="registrationNumber"
                defaultValue={business.registration_number ?? ""}
              />
            </Field>
            <Field htmlFor="vatNumber" label="VAT number">
              <Input
                id="vatNumber"
                name="vatNumber"
                defaultValue={business.vat_number ?? ""}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Banking details"
          description="Use these details on invoices when customers need to pay by bank transfer."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field htmlFor="bankName" label="Bank name">
              <Input
                id="bankName"
                name="bankName"
                defaultValue={business.bank_name ?? ""}
              />
            </Field>
            <Field htmlFor="bankAccountName" label="Account name">
              <Input
                id="bankAccountName"
                name="bankAccountName"
                defaultValue={business.bank_account_name ?? ""}
              />
            </Field>
            <Field htmlFor="bankAccountNumber" label="Account number">
              <Input
                id="bankAccountNumber"
                name="bankAccountNumber"
                defaultValue={business.bank_account_number ?? ""}
              />
            </Field>
            <Field htmlFor="bankBranchCode" label="Branch code">
              <Input
                id="bankBranchCode"
                name="bankBranchCode"
                defaultValue={business.bank_branch_code ?? ""}
              />
            </Field>
          </div>
          <Field htmlFor="paymentInstructions" label="Payment instructions">
            <Textarea
              id="paymentInstructions"
              name="paymentInstructions"
              defaultValue={business.payment_instructions ?? ""}
            />
          </Field>
          {business.logo_url ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-500">Current logo</p>
              <Image
                src={business.logo_url}
                alt={`${business.name} logo`}
                width={160}
                height={64}
                className="mt-3 h-16 w-auto rounded-xl object-contain"
              />
            </div>
          ) : null}
        </FormSection>

        <PendingButton pendingLabel="Saving settings...">
          Save business settings
        </PendingButton>
      </form>
    </div>
  );
}
