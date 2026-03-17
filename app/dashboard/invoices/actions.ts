"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { requirePaidBusiness } from "@/lib/auth";
import { logActivityEvent } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  invoiceItems,
  invoices,
  quoteItems,
  quotes,
  services
} from "@/lib/db/schema";
import { getDefaultInvoiceDueDate } from "@/lib/invoices";
import { convertQuoteToInvoiceSchema, invoiceStatusSchema } from "@/lib/validations";
import { buildInvoiceItemsFromQuoteItems } from "@/lib/workflows";

export async function convertQuoteToInvoice(formData: FormData) {
  const redirectTo = String(
    formData.get("redirectTo") ?? "/dashboard/quotes"
  );

  try {
    const payload = convertQuoteToInvoiceSchema.parse({
      quoteId: formData.get("quoteId"),
      dueDate: formData.get("dueDate") ?? getDefaultInvoiceDueDate()
    });

    const business = await requirePaidBusiness();

    const [existingInvoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.businessId, business.id),
          eq(invoices.quoteId, payload.quoteId)
        )
      )
      .limit(1);

    if (existingInvoice) {
      redirect(
        `/dashboard/invoices/${existingInvoice.id}?success=Invoice%20already%20exists`
      );
    }

    const [quote] = await db
      .select({
        id: quotes.id,
        customerId: quotes.customerId,
        total: quotes.total
      })
      .from(quotes)
      .where(and(eq(quotes.businessId, business.id), eq(quotes.id, payload.quoteId)))
      .limit(1);

    if (!quote) {
      redirect(
        `${redirectTo}?error=${encodeURIComponent("Quote not found")}`
      );
    }

    const items = await db
      .select({
        serviceId: quoteItems.serviceId,
        quantity: quoteItems.quantity,
        price: quoteItems.price,
        subtotal: quoteItems.subtotal,
        service: {
          name: services.name,
          description: services.description
        }
      })
      .from(quoteItems)
      .leftJoin(services, eq(quoteItems.serviceId, services.id))
      .where(eq(quoteItems.quoteId, quote.id));

    const invoice = await db.transaction(async (tx) => {
      const [createdInvoice] = await tx
        .insert(invoices)
        .values({
          businessId: business.id,
          customerId: quote.customerId,
          quoteId: quote.id,
          status: "draft",
          total: quote.total,
          dueDate: payload.dueDate
        })
        .returning({ id: invoices.id });

      await tx.insert(invoiceItems).values(
        buildInvoiceItemsFromQuoteItems(items).map((item) => ({
          invoiceId: createdInvoice.id,
          serviceId: item.serviceId,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        }))
      );

      return createdInvoice;
    });

    await logActivityEvent({
      businessId: business.id,
      customerId: quote.customerId,
      quoteId: quote.id,
      invoiceId: invoice.id,
      type: "invoice.created",
      description: `Invoice was created from quote ${quote.id.slice(0, 8).toUpperCase()}.`
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quotes");
    revalidatePath(`/dashboard/quotes/${quote.id}`);
    revalidatePath("/dashboard/invoices");
    redirect(`/dashboard/invoices/${invoice.id}?success=Invoice%20created`);
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(
        `${redirectTo}?error=${encodeURIComponent(
          error.issues[0]?.message ?? "Invalid invoice values"
        )}`
      );
    }
    if (error instanceof Error) {
      redirect(`${redirectTo}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  nextStatus: "draft" | "sent" | "paid" | "overdue"
) {
  const business = await requirePaidBusiness();
  const status = invoiceStatusSchema.parse(nextStatus);

  try {
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ status })
      .where(and(eq(invoices.businessId, business.id), eq(invoices.id, invoiceId)))
      .returning({ id: invoices.id, customerId: invoices.customerId, status: invoices.status });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${invoiceId}`);

    if (!updatedInvoice) {
      return {
        error: true,
        message: "Invoice not found"
      };
    }

    await logActivityEvent({
      businessId: business.id,
      customerId: updatedInvoice.customerId,
      invoiceId: updatedInvoice.id,
      type: "invoice.status_updated",
      description: `Invoice status was updated to ${updatedInvoice.status}.`
    });

    return {
      error: false,
      message:
        status === "paid"
          ? "Invoice marked as paid"
          : `Invoice updated to ${status}`
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to update invoice"
    };
  }
}

export async function recordInvoiceReminder(
  invoiceId: string,
  channel: "email" | "whatsapp"
) {
  const business = await requirePaidBusiness();

  try {
    const [invoice] = await db
      .select({
        id: invoices.id,
        customerId: invoices.customerId,
        status: invoices.status
      })
      .from(invoices)
      .where(and(eq(invoices.businessId, business.id), eq(invoices.id, invoiceId)))
      .limit(1);

    if (!invoice) {
      return {
        error: true,
        message: "Invoice not found"
      };
    }

    if (invoice.status === "draft") {
      await db
        .update(invoices)
        .set({ status: "sent" })
        .where(eq(invoices.id, invoice.id));
    }

    await logActivityEvent({
      businessId: business.id,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      type: "invoice.reminder_sent",
      channel,
      description: `Invoice reminder was prepared via ${channel}.`
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${invoice.id}`);

    return {
      error: false,
      message:
        channel === "email"
          ? "Invoice email prepared"
          : "Invoice WhatsApp reminder prepared"
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to prepare reminder"
    };
  }
}
