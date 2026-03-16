"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { quoteSchema } from "@/lib/validations";

export async function createQuote(formData: FormData) {
  try {
    const business = await requireBusiness();
    const rawItems = String(formData.get("items") ?? "[]");
    const items = JSON.parse(rawItems);
    const payload = quoteSchema.parse({
      customerId: formData.get("customerId"),
      status: formData.get("status"),
      items
    });

    const total = payload.items.reduce((sum, item) => sum + item.subtotal, 0);
    const supabase = await createClient();

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        business_id: business.id,
        customer_id: payload.customerId,
        status: payload.status,
        total
      })
      .select("id")
      .single();

    if (quoteError || !quote) {
      redirect(`/dashboard/quotes/new?error=${encodeURIComponent(quoteError?.message ?? "Unable to create quote")}`);
    }

    const { error: itemsError } = await supabase.from("quote_items").insert(
      payload.items.map((item) => ({
        quote_id: quote.id,
        service_id: item.service_id,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal
      }))
    );

    if (itemsError) {
      redirect(`/dashboard/quotes/new?error=${encodeURIComponent(itemsError.message)}`);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quotes");
    redirect(`/dashboard/quotes/${quote.id}?success=Quote%20created`);
  } catch (error) {
    if (error instanceof ZodError) {
      redirect(`/dashboard/quotes/new?error=${encodeURIComponent(error.issues[0]?.message ?? "Invalid form values")}`);
    }
    throw error;
  }
}

export async function updateQuoteStatus(
  quoteId: string,
  status: "draft" | "sent"
) {
  const business = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("quotes")
    .update({ status })
    .eq("business_id", business.id)
    .eq("id", quoteId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quotes");
  revalidatePath(`/dashboard/quotes/${quoteId}`);

  if (error) {
    return {
      error: true,
      message: error.message
    };
  }

  return {
    error: false,
    message: `Quote marked as ${status}`
  };
}

export async function deleteQuote(formData: FormData) {
  const business = await requireBusiness();
  const quoteId = String(formData.get("quoteId"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("business_id", business.id)
    .eq("id", quoteId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quotes");

  if (error) {
    return {
      error: true,
      message: error.message
    };
  }

  return {
    error: false,
    message: "Quote deleted"
  };
}
