import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, invoices } from "@/lib/db/schema";
import { validatePublicAccessToken } from "@/lib/public-access";
import { getPublicInvoiceById } from "@/lib/queries";
import { generateInvoicePdf } from "@/lib/pdf/invoice";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const [ownedInvoice] = session?.user?.id
    ? await db
        .select({ id: invoices.id })
        .from(invoices)
        .innerJoin(businesses, eq(invoices.businessId, businesses.id))
        .where(and(eq(invoices.id, id), eq(businesses.ownerId, session.user.id)))
        .limit(1)
    : [];

  if (
    !ownedInvoice?.id &&
    !(await validatePublicAccessToken({ type: "invoice-pdf", id, token }))
  ) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  const invoice = await getPublicInvoiceById(id);

  if (!invoice || !invoice.business || !invoice.customer) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  const pdf = await generateInvoicePdf({
    business: invoice.business,
    customer: invoice.customer,
    invoice,
    items: invoice.items ?? []
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`
    }
  });
}
