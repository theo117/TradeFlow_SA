"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import { requirePaidBusiness } from "@/lib/auth";
import { logActivityEvent } from "@/lib/activity";
import { db } from "@/lib/db";
import { businesses, customers, quoteItems, quotes, services } from "@/lib/db/schema";
import { revokePublicShareTokens } from "@/lib/public-access";
import { quoteSchema } from "@/lib/validations";
import { sendQuoteWhatsappMessage } from "@/lib/whatsapp";
import { calculateQuoteTotal } from "@/lib/workflows";
import { isNextRedirectError } from "@/lib/navigation";

export async function createQuote(formData: FormData) {
  try {
    const business = await requirePaidBusiness();
    const rawItems = String(formData.get("items") ?? "[]");
    const items = JSON.parse(rawItems);
    const payload = quoteSchema.parse({
      customerId: formData.get("customerId"),
      status: formData.get("status"),
      items
    });

    const total = calculateQuoteTotal(payload.items);
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
      redirect("/dashboard/quotes/new?error=Customer%20not%20found");
    }

    const serviceIds = [...new Set(payload.items.map((item) => item.service_id))];
    const availableServices = await db
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.businessId, business.id),
          inArray(services.id, serviceIds)
        )
      );

    if (availableServices.length !== serviceIds.length) {
      redirect("/dashboard/quotes/new?error=One%20or%20more%20services%20are%20invalid");
    }

    const quote = await db.transaction(async (tx) => {
      const [createdQuote] = await tx
        .insert(quotes)
        .values({
          businessId: business.id,
          customerId: payload.customerId,
          status: payload.status,
          total
        })
        .returning({ id: quotes.id, customerId: quotes.customerId, status: quotes.status });

      await tx.insert(quoteItems).values(
        payload.items.map((item) => ({
          quoteId: createdQuote.id,
          serviceId: item.service_id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        }))
      );

      return createdQuote;
    });

    await logActivityEvent({
      businessId: business.id,
      customerId: quote.customerId,
      quoteId: quote.id,
      type: "quote.created",
      description: `Quote ${quote.id.slice(0, 8).toUpperCase()} was created with status ${quote.status}.`
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quotes");
    redirect(`/dashboard/quotes/${quote.id}?success=Quote%20created`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof ZodError) {
      redirect(`/dashboard/quotes/new?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    if (error instanceof Error) {
      redirect(`/dashboard/quotes/new?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function updateQuoteStatus(
  quoteId: string,
  status: "draft" | "sent" | "accepted"
) {
  const business = await requirePaidBusiness();

  try {
    const [updatedQuote] = await db
      .update(quotes)
      .set({ status })
      .where(and(eq(quotes.businessId, business.id), eq(quotes.id, quoteId)))
      .returning({ id: quotes.id, customerId: quotes.customerId, status: quotes.status });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quotes");
    revalidatePath(`/dashboard/quotes/${quoteId}`);

    if (!updatedQuote) {
      return {
        error: true,
        message: "Quote not found"
      };
    }

    await logActivityEvent({
      businessId: business.id,
      customerId: updatedQuote.customerId,
      quoteId: updatedQuote.id,
      type: "quote.status_updated",
      description: `Quote ${updatedQuote.id.slice(0, 8).toUpperCase()} was marked as ${updatedQuote.status}.`
    });

    return {
      error: false,
      message: `Quote marked as ${status}`
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to update quote"
    };
  }
}

export async function deleteQuote(formData: FormData) {
  const business = await requirePaidBusiness();
  const quoteId = String(formData.get("quoteId"));

  try {
    const [deletedQuote] = await db
      .delete(quotes)
      .where(and(eq(quotes.businessId, business.id), eq(quotes.id, quoteId)))
      .returning({ id: quotes.id });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quotes");

    if (!deletedQuote) {
      return {
        error: true,
        message: "Quote not found"
      };
    }

    return {
      error: false,
      message: "Quote deleted"
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to delete quote"
    };
  }
}

export async function sendQuoteViaWhatsapp(quoteId: string) {
  const business = await requirePaidBusiness();

  try {
    const [quote] = await db
      .select({
        id: quotes.id,
        status: quotes.status,
        total: quotes.total,
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
      .from(quotes)
      .innerJoin(customers, eq(quotes.customerId, customers.id))
      .innerJoin(businesses, eq(quotes.businessId, businesses.id))
      .where(and(eq(quotes.businessId, business.id), eq(quotes.id, quoteId)))
      .limit(1);

    if (!quote) {
      return {
        error: true,
        message: "Quote not found",
        delivery: "manual" as const
      };
    }

    if (quote.status === "draft") {
      await db
        .update(quotes)
        .set({ status: "sent" })
        .where(eq(quotes.id, quote.id));
    }

    const whatsappResult = await sendQuoteWhatsappMessage({
      quoteId: quote.id,
      quoteReference: quote.id.slice(0, 8).toUpperCase(),
      total: Number(quote.total),
      customer: {
        id: quote.customer.id,
        name: quote.customer.name,
        phone: quote.customer.phone,
        whatsapp_phone: quote.customer.whatsappPhone,
        whatsapp_opt_in: quote.customer.whatsappOptIn
      },
      business: {
        id: quote.business.id,
        name: quote.business.name,
        whatsapp_phone_number_id: quote.business.whatsappPhoneNumberId
      }
    });

    if (quote.status === "draft" && whatsappResult.ok) {
      await logActivityEvent({
        businessId: business.id,
        customerId: quote.customer.id,
        quoteId: quote.id,
        type: "quote.status_updated",
        description: `Quote ${quote.id.slice(0, 8).toUpperCase()} was marked as sent.`
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quotes");
    revalidatePath(`/dashboard/quotes/${quoteId}`);

    return {
      error: !whatsappResult.ok && whatsappResult.delivery !== "manual",
      message:
        whatsappResult.delivery === "manual"
          ? "Opening WhatsApp draft"
          : whatsappResult.message,
      delivery: whatsappResult.delivery
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unable to send quote",
      delivery: "manual" as const
    };
  }
}

export async function revokeQuotePublicLinks(quoteId: string) {
  const business = await requirePaidBusiness();

  try {
    const revokedCount = await revokePublicShareTokens({
      businessId: business.id,
      documentType: "quote",
      documentId: quoteId,
      revokedByUserId: business.owner_id
    });

    revalidatePath("/dashboard/quotes");
    revalidatePath(`/dashboard/quotes/${quoteId}`);
    revalidatePath(`/quote/${quoteId}`);

    return {
      error: false,
      message:
        revokedCount > 0
          ? "Public quote links revoked"
          : "No active public quote links to revoke"
    };
  } catch (error) {
    return {
      error: true,
      message:
        error instanceof Error
          ? error.message
          : "Unable to revoke public quote links"
    };
  }
}
