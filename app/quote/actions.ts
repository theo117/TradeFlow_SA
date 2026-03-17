"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { logActivityEvent } from "@/lib/activity";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { validatePublicAccessToken } from "@/lib/public-access";

export async function acceptQuote(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  const token = String(formData.get("token") ?? "");
  const publicUrl = new URL(`/quote/${quoteId}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  publicUrl.searchParams.set("token", token);

  if (!quoteId) {
    redirect("/dashboard/quotes?error=Quote%20not%20found");
  }

  if (!(await validatePublicAccessToken({ type: "quote", id: quoteId, token }))) {
    redirect("/login?error=Invalid%20or%20expired%20quote%20link");
  }

  const [quote] = await db
    .select({
      id: quotes.id,
      businessId: quotes.businessId,
      customerId: quotes.customerId,
      status: quotes.status
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!quote) {
    publicUrl.searchParams.set("error", "Quote not found");
    redirect(publicUrl.toString());
  }

  if (quote.status === "accepted") {
    publicUrl.searchParams.set("success", "Quote already accepted");
    redirect(publicUrl.toString());
  }

  if (quote.status !== "sent") {
    publicUrl.searchParams.set("error", "Only sent quotes can be accepted");
    redirect(publicUrl.toString());
  }

  await db
    .update(quotes)
    .set({ status: "accepted" })
    .where(eq(quotes.id, quoteId));

  await logActivityEvent({
    businessId: quote.businessId,
    customerId: quote.customerId,
    quoteId: quote.id,
    type: "quote.accepted",
    description: `Quote ${quote.id.slice(0, 8).toUpperCase()} was accepted by the customer.`
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quotes");
  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath(`/quote/${quoteId}`);

  publicUrl.searchParams.set("success", "Quote accepted");
  redirect(publicUrl.toString());
}
