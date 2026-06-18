import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, invoices } from "@/lib/db/schema";
import { validatePublicAccessToken } from "@/lib/public-access";
import { getPublicInvoiceById } from "@/lib/queries";
import { generateInvoicePdf } from "@/lib/pdf/invoice";
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
    logInfo("Invoice PDF generation started", {
      ...requestContext,
      invoiceId: id
    });
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const [ownedInvoice] = session?.user?.id
      ? await db
          .select({
            id: invoices.id,
            subscriptionStatus: businesses.subscriptionStatus,
            currentPeriodEnd: businesses.currentPeriodEnd,
            trialEndsAt: businesses.trialEndsAt,
            createdAt: businesses.createdAt
          })
          .from(invoices)
          .innerJoin(businesses, eq(invoices.businessId, businesses.id))
          .where(and(eq(invoices.id, id), eq(businesses.ownerId, session.user.id)))
          .limit(1)
      : [];

    if (
      ownedInvoice?.id &&
      !hasBillingAccess({
        subscription_status: ownedInvoice.subscriptionStatus,
        current_period_end: ownedInvoice.currentPeriodEnd,
        trial_ends_at: ownedInvoice.trialEndsAt,
        created_at: ownedInvoice.createdAt
      })
    ) {
      logWarn("Invoice PDF access expired", {
        ...requestContext,
        invoiceId: id,
        ms: Date.now() - startedAt
      });
      return new NextResponse("Billing required", { status: 403 });
    }

    if (
      !ownedInvoice?.id &&
      !(await validatePublicAccessToken({ type: "invoice-pdf", id, token }))
    ) {
      logWarn("Invoice PDF access denied", {
        ...requestContext,
        invoiceId: id,
        ms: Date.now() - startedAt
      });
      return new NextResponse("Invoice not found", { status: 404 });
    }

    const invoice = await getPublicInvoiceById(id);

    if (!invoice || !invoice.business || !invoice.customer) {
      logWarn("Invoice PDF source data missing", {
        ...requestContext,
        invoiceId: id,
        ms: Date.now() - startedAt
      });
      return new NextResponse("Invoice not found", { status: 404 });
    }

    const pdf = await generateInvoicePdf({
      business: invoice.business,
      customer: invoice.customer,
      invoice,
      items: invoice.items ?? []
    });

    logInfo("Invoice PDF generated", {
      ...requestContext,
      invoiceId: id,
      bytes: pdf.byteLength,
      ms: Date.now() - startedAt
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`
      }
    });
  } catch (error) {
    logError("Invoice PDF generation failed", error, {
      ...requestContext,
      invoiceId: id,
      ms: Date.now() - startedAt
    });
    return new NextResponse("Unable to generate invoice PDF", { status: 500 });
  }
}
