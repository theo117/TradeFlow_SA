"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { logActivityEvent } from "@/lib/activity";
import { requirePaidBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  customers,
  invoiceItems,
  invoices,
  recurringInvoiceTemplates
} from "@/lib/db/schema";
import { recurringInvoiceTemplateSchema } from "@/lib/validations";
import { isNextRedirectError } from "@/lib/navigation";

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function advanceDate(
  value: string,
  frequency: "monthly" | "quarterly" | "annually"
) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const months =
    frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export async function createRecurringInvoiceTemplate(formData: FormData) {
  try {
    const business = await requirePaidBusiness();
    const payload = recurringInvoiceTemplateSchema.parse({
      customerId: formData.get("customerId"),
      name: formData.get("name"),
      description: formData.get("description"),
      frequency: formData.get("frequency"),
      total: formData.get("total"),
      nextInvoiceDate: formData.get("nextInvoiceDate"),
      paymentTermsDays: formData.get("paymentTermsDays")
    });

    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.businessId, business.id),
          eq(customers.id, payload.customerId)
        )
      )
      .limit(1);

    if (!customer) {
      redirect("/dashboard/recurring?error=Customer%20not%20found");
    }

    const [template] = await db
      .insert(recurringInvoiceTemplates)
      .values({
        businessId: business.id,
        customerId: payload.customerId,
        name: payload.name,
        description: payload.description,
        frequency: payload.frequency,
        total: payload.total,
        nextInvoiceDate: payload.nextInvoiceDate,
        paymentTermsDays: payload.paymentTermsDays
      })
      .returning({
        id: recurringInvoiceTemplates.id,
        customerId: recurringInvoiceTemplates.customerId,
        frequency: recurringInvoiceTemplates.frequency
      });

    await logActivityEvent({
      businessId: business.id,
      customerId: template.customerId,
      type: "recurring_invoice.created",
      description: `Recurring invoice ${payload.name} was created on a ${template.frequency} schedule.`
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/recurring");
    redirect("/dashboard/recurring?success=Recurring%20invoice%20created");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof ZodError) {
      redirect(
        `/dashboard/recurring?error=${encodeURIComponent(
          error.issues[0]?.message ?? "Invalid recurring invoice values"
        )}`
      );
    }
    if (error instanceof Error) {
      redirect(`/dashboard/recurring?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function updateRecurringInvoiceTemplateStatus(
  templateId: string,
  status: "active" | "paused"
) {
  const business = await requirePaidBusiness();

  try {
    const [template] = await db
      .update(recurringInvoiceTemplates)
      .set({ status })
      .where(
        and(
          eq(recurringInvoiceTemplates.businessId, business.id),
          eq(recurringInvoiceTemplates.id, templateId)
        )
      )
      .returning({
        id: recurringInvoiceTemplates.id,
        customerId: recurringInvoiceTemplates.customerId,
        name: recurringInvoiceTemplates.name,
        status: recurringInvoiceTemplates.status
      });

    if (!template) {
      return { error: true, message: "Recurring invoice not found" };
    }

    await logActivityEvent({
      businessId: business.id,
      customerId: template.customerId,
      type: "recurring_invoice.status_updated",
      description: `Recurring invoice ${template.name} was ${template.status}.`
    });

    revalidatePath("/dashboard/recurring");
    return { error: false, message: `Recurring invoice ${status}` };
  } catch (error) {
    return {
      error: true,
      message:
        error instanceof Error
          ? error.message
          : "Unable to update recurring invoice"
    };
  }
}

export async function createInvoiceFromRecurringTemplate(templateId: string) {
  const business = await requirePaidBusiness();

  try {
    const [template] = await db
      .select()
      .from(recurringInvoiceTemplates)
      .where(
        and(
          eq(recurringInvoiceTemplates.businessId, business.id),
          eq(recurringInvoiceTemplates.id, templateId)
        )
      )
      .limit(1);

    if (!template) {
      return { error: true, message: "Recurring invoice not found" };
    }

    if (template.status !== "active") {
      return { error: true, message: "Recurring invoice is paused" };
    }

    const dueDate = addDays(template.nextInvoiceDate, template.paymentTermsDays);
    const nextInvoiceDate = advanceDate(
      template.nextInvoiceDate,
      template.frequency
    );

    const invoice = await db.transaction(async (tx) => {
      const [createdInvoice] = await tx
        .insert(invoices)
        .values({
          businessId: business.id,
          customerId: template.customerId,
          status: "draft",
          total: template.total,
          dueDate
        })
        .returning({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber
        });

      await tx.insert(invoiceItems).values({
        invoiceId: createdInvoice.id,
        description: template.description,
        quantity: 1,
        price: template.total,
        subtotal: template.total
      });

      await tx
        .update(recurringInvoiceTemplates)
        .set({ nextInvoiceDate })
        .where(eq(recurringInvoiceTemplates.id, template.id));

      return createdInvoice;
    });

    await logActivityEvent({
      businessId: business.id,
      customerId: template.customerId,
      invoiceId: invoice.id,
      type: "recurring_invoice.invoice_created",
      description: `Invoice ${invoice.invoiceNumber} was created from recurring invoice ${template.name}.`
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/recurring");

    return {
      error: false,
      message: `Invoice ${invoice.invoiceNumber} created`,
      invoiceId: invoice.id
    };
  } catch (error) {
    return {
      error: true,
      message:
        error instanceof Error
          ? error.message
          : "Unable to create recurring invoice"
    };
  }
}
