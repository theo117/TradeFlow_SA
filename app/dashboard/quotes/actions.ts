"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import { requirePaidBusiness } from "@/lib/auth";
import { logActivityEvent } from "@/lib/activity";
import { db } from "@/lib/db";
import { customers, quoteItems, quotes, services } from "@/lib/db/schema";
import { quoteSchema } from "@/lib/validations";
import { calculateQuoteTotal } from "@/lib/workflows";

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
