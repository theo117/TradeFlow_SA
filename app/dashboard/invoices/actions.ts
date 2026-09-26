"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { ZodError } from "zod";
import { requirePaidBusiness } from "@/lib/auth";
import { logActivityEvent } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  auditEvents,
  businesses,
  customers,
  invoiceItems,
  invoices,
  quoteItems,
  quotes,
  services
} from "@/lib/db/schema";
import { getDefaultInvoiceDueDate } from "@/lib/invoices";
import { revokePublicShareTokens } from "@/lib/public-access";
import { convertQuoteToInvoiceSchema, invoiceStatusSchema } from "@/lib/validations";
import { sendInvoiceWhatsappMessage } from "@/lib/whatsapp";
import { buildInvoiceItemsFromQuoteItems } from "@/lib/workflows";
import { isNextRedirectError } from "@/lib/navigation";

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
    if (isNextRedirectError(error)) {
      throw error;
    }
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
  try {
    const status = invoiceStatusSchema.parse(nextStatus);
    if (status === "void") throw new Error("Use the void action to preserve the invoice audit trail");
    const updatedInvoice = await db.transaction(async (tx) => {
      const [current] = await tx.select({ status: invoices.status }).from(invoices)
        .where(and(eq(invoices.businessId, business.id), eq(invoices.id, invoiceId)))
        .limit(1).for("update");
      if (!current) return null;
      if (current.status === "void") throw new Error("Void invoices cannot change status");
      if (current.status === "paid" && status !== "paid") throw new Error("Paid invoices are protected and cannot change status");
      if (current.status !== "draft" && status === "draft") throw new Error("Issued invoices cannot be returned to draft. Void an unpaid invoice instead.");
      const [updated] = await tx.update(invoices).set({ status })
        .where(and(eq(invoices.businessId, business.id), eq(invoices.id, invoiceId)))
        .returning({ id: invoices.id, customerId: invoices.customerId, status: invoices.status });
      return updated;
    });

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

    if (invoice.status === "void") {
      return { error: true, message: "Void invoices are not payable and cannot be sent for collection" };
    }

    if (invoice.status === "draft") {
      await db
        .update(invoices)
        .set({ status: "sent" })
        .where(and(eq(invoices.businessId, business.id), eq(invoices.id, invoice.id), eq(invoices.status, "draft")));
    }

    if (channel === "whatsapp") {
      const [invoiceDetail] = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          total: invoices.total,
          dueDate: invoices.dueDate,
          customer: {
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            whatsappPhone: customers.whatsappPhone,
            whatsappOptIn: customers.whatsappOptIn
          },
          business: {
            id: businesses.id,
            name: businesses.name,
            whatsappPhoneNumberId: businesses.whatsappPhoneNumberId
          }
        })
        .from(invoices)
        .innerJoin(customers, eq(invoices.customerId, customers.id))
        .innerJoin(businesses, eq(invoices.businessId, businesses.id))
        .where(and(eq(invoices.businessId, business.id), eq(invoices.id, invoiceId)))
        .limit(1);

      if (!invoiceDetail) {
        return {
          error: true,
          message: "Invoice not found",
          delivery: "manual" as const
        };
      }

      const whatsappResult = await sendInvoiceWhatsappMessage({
        invoiceId: invoiceDetail.id,
        invoiceNumber: invoiceDetail.invoiceNumber,
        total: Number(invoiceDetail.total),
        dueDate: invoiceDetail.dueDate,
        reminder: invoice.status !== "draft",
        customer: {
          id: invoiceDetail.customer.id,
          name: invoiceDetail.customer.name,
          phone: invoiceDetail.customer.phone,
          whatsapp_phone: invoiceDetail.customer.whatsappPhone,
          whatsapp_opt_in: invoiceDetail.customer.whatsappOptIn
        },
        business: {
          id: invoiceDetail.business.id,
          name: invoiceDetail.business.name,
          whatsapp_phone_number_id: invoiceDetail.business.whatsappPhoneNumberId
        }
      });

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/invoices");
      revalidatePath(`/dashboard/invoices/${invoice.id}`);

      return {
        error: !whatsappResult.ok && whatsappResult.delivery !== "manual",
        message:
          whatsappResult.delivery === "manual"
            ? "Opening WhatsApp draft"
            : whatsappResult.message,
        delivery: whatsappResult.delivery
      };
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
      message: "Invoice email prepared",
      delivery: "manual" as const
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to prepare reminder",
      delivery: "manual" as const
    };
  }
}

export async function revokeInvoicePublicLinks(invoiceId: string) {
  const business = await requirePaidBusiness();

  try {
    const revokedCount = await revokePublicShareTokens({
      businessId: business.id,
      documentType: "invoice",
      documentId: invoiceId,
      revokedByUserId: business.owner_id
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    revalidatePath(`/invoice/${invoiceId}`);

    return {
      error: false,
      message:
        revokedCount > 0
          ? "Public invoice links revoked"
          : "No active public invoice links to revoke"
    };
  } catch (error) {
    return {
      error: true,
      message:
        error instanceof Error
          ? error.message
          : "Unable to revoke public invoice links"
    };
  }
}

export async function deleteInvoice(invoiceId: string) {
  const business = await requirePaidBusiness();

  try {
    const [deletedInvoice] = await db
      .delete(invoices)
      .where(
        and(eq(invoices.businessId, business.id), eq(invoices.id, invoiceId), eq(invoices.status, "draft"))
      )
      .returning({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        quoteId: invoices.quoteId
      });

    if (!deletedInvoice) {
      return { error: true, message: "Only draft invoices can be deleted. Sent or overdue invoices must be voided; paid and void invoices are protected." };
    }

    await logActivityEvent({
      businessId: business.id,
      customerId: deletedInvoice.customerId,
      quoteId: deletedInvoice.quoteId,
      type: "invoice.deleted",
      description: `Invoice ${deletedInvoice.invoiceNumber} was deleted.`
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/quotes");

    if (deletedInvoice.quoteId) {
      revalidatePath(`/dashboard/quotes/${deletedInvoice.quoteId}`);
    }

    return {
      error: false,
      message: "Invoice deleted"
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to delete invoice"
    };
  }
}


export async function voidInvoice(invoiceId: string) {
  const business = await requirePaidBusiness();
  try {
    if (!business.owner_id) throw new Error("An authenticated actor is required to void an invoice");
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx.select({
        id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status,
        customerId: invoices.customerId, quoteId: invoices.quoteId,
        recurringTemplateId: invoices.recurringTemplateId, recurringPeriod: invoices.recurringPeriod,
        total: sql<string>`${invoices.total}::text`, dueDate: invoices.dueDate, createdAt: invoices.createdAt
      }).from(invoices)
        .where(and(eq(invoices.businessId, business.id), eq(invoices.id, invoiceId)))
        .limit(1).for("update");
      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status === "void") return { invoice, changed: false };
      if (invoice.status === "paid") throw new Error("Paid invoices are protected and cannot be voided or deleted");
      if (invoice.status !== "sent" && invoice.status !== "overdue") throw new Error("Only sent or overdue invoices can be voided. Draft invoices can be deleted.");

      // Persist the authenticated actor and exact financial identity in the same
      // transaction. Do not use the best-effort audit/activity logging wrappers.
      await tx.insert(auditEvents).values({
        businessId: business.id,
        userId: business.owner_id,
        action: "void",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: {
          invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber,
          actorUserId: business.owner_id, businessId: business.id,
          customerId: invoice.customerId, quoteId: invoice.quoteId,
          recurringTemplateId: invoice.recurringTemplateId, recurringPeriod: invoice.recurringPeriod,
          total: invoice.total, dueDate: invoice.dueDate, invoiceCreatedAt: invoice.createdAt,
          previousStatus: invoice.status, resultingStatus: "void"
        }
      });
      await tx.update(invoices).set({ status: "void" })
        .where(and(eq(invoices.businessId, business.id), eq(invoices.id, invoice.id)));
      return { invoice, changed: true };
    });
    if (result.changed) {
      await logActivityEvent({ businessId: business.id, customerId: result.invoice.customerId,
        invoiceId, type: "invoice.voided", description: `Invoice ${result.invoice.invoiceNumber} was voided and is not payable.` });
    }
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    revalidatePath(`/dashboard/customers/${result.invoice.customerId}`);
    revalidatePath(`/invoice/${invoiceId}`);
    return { error: false, message: result.changed ? "Invoice voided. It is no longer payable." : "Invoice already void", invoiceId };
  } catch (error) {
    return { error: true, message: error instanceof Error ? error.message : "Unable to void invoice" };
  }
}
