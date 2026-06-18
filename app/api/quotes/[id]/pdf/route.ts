import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, quotes } from "@/lib/db/schema";
import { validatePublicAccessToken } from "@/lib/public-access";
import { getPublicQuoteById } from "@/lib/queries";
import { generateQuotePdf } from "@/lib/pdf/quote";
import { hasBillingAccess } from "@/lib/auth";
import {
  getRequestLogContext,
  logError,
  logInfo,
  logWarn
} from "@/lib/observability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const requestContext = getRequestLogContext(request);
  const { id } = await params;
  try {
    logInfo("Quote PDF generation started", {
      ...requestContext,
      quoteId: id
    });
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const [ownedQuote] = session?.user?.id
      ? await db
          .select({
            id: quotes.id,
            subscriptionStatus: businesses.subscriptionStatus,
            currentPeriodEnd: businesses.currentPeriodEnd,
            trialEndsAt: businesses.trialEndsAt,
            createdAt: businesses.createdAt
          })
          .from(quotes)
          .innerJoin(businesses, eq(quotes.businessId, businesses.id))
          .where(and(eq(quotes.id, id), eq(businesses.ownerId, session.user.id)))
          .limit(1)
      : [];

    if (
      ownedQuote?.id &&
      !hasBillingAccess({
        subscription_status: ownedQuote.subscriptionStatus,
        current_period_end: ownedQuote.currentPeriodEnd,
        trial_ends_at: ownedQuote.trialEndsAt,
        created_at: ownedQuote.createdAt
      })
    ) {
      logWarn("Quote PDF access expired", {
        ...requestContext,
        quoteId: id,
        ms: Date.now() - startedAt
      });
      return new NextResponse("Billing required", { status: 403 });
    }

    if (
      !ownedQuote?.id &&
      !(await validatePublicAccessToken({ type: "quote-pdf", id, token }))
    ) {
      logWarn("Quote PDF access denied", {
        ...requestContext,
        quoteId: id,
        ms: Date.now() - startedAt
      });
      return new NextResponse("Quote not found", { status: 404 });
    }

    const quote = await getPublicQuoteById(id);

    if (!quote || !quote.business || !quote.customer) {
      logWarn("Quote PDF source data missing", {
        ...requestContext,
        quoteId: id,
        ms: Date.now() - startedAt
      });
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

    logInfo("Quote PDF generated", {
      ...requestContext,
      quoteId: id,
      bytes: pdf.byteLength,
      ms: Date.now() - startedAt
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quote-${quote.id.slice(0, 8)}.pdf"`
      }
    });
  } catch (error) {
    logError("Quote PDF generation failed", error, {
      ...requestContext,
      quoteId: id,
      ms: Date.now() - startedAt
    });
    return new NextResponse("Unable to generate quote PDF", { status: 500 });
  }
}
