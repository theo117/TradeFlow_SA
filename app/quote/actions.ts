"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";

export async function acceptQuote(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");

  if (!quoteId) {
    redirect("/dashboard/quotes?error=Quote%20not%20found");
  }

  const [quote] = await db
    .select({
      id: quotes.id,
      status: quotes.status
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!quote) {
    redirect(`/quote/${quoteId}?error=Quote%20not%20found`);
  }

  if (quote.status === "accepted") {
    redirect(`/quote/${quoteId}?success=Quote%20already%20accepted`);
  }

  if (quote.status !== "sent") {
    redirect(`/quote/${quoteId}?error=Only%20sent%20quotes%20can%20be%20accepted`);
  }

  await db
    .update(quotes)
    .set({ status: "accepted" })
    .where(eq(quotes.id, quoteId));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quotes");
  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath(`/quote/${quoteId}`);

  redirect(`/quote/${quoteId}?success=Quote%20accepted`);
}
