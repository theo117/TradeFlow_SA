import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, quotes } from "@/lib/db/schema";
import { validatePublicAccessToken } from "@/lib/public-access";
import { getPublicQuoteById } from "@/lib/queries";
import { generateQuotePdf } from "@/lib/pdf/quote";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const [ownedQuote] = session?.user?.id
    ? await db
        .select({ id: quotes.id })
        .from(quotes)
        .innerJoin(businesses, eq(quotes.businessId, businesses.id))
        .where(and(eq(quotes.id, id), eq(businesses.ownerId, session.user.id)))
        .limit(1)
    : [];

  if (
    !ownedQuote?.id &&
    !(await validatePublicAccessToken({ type: "quote-pdf", id, token }))
  ) {
    return new NextResponse("Quote not found", { status: 404 });
  }

  const quote = await getPublicQuoteById(id);

  if (!quote || !quote.business || !quote.customer) {
    return new NextResponse("Quote not found", { status: 404 });
  }

  const pdf = await generateQuotePdf({
    business: quote.business,
    customer: quote.customer,
    quote,
    items: (quote.items ?? []).map((item) => ({
      description: item.service?.name ?? "Service",
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal
    }))
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quote-${quote.id.slice(0, 8)}.pdf"`
    }
  });
}
