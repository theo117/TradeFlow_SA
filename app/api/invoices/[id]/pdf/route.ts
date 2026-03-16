import { NextResponse } from "next/server";
import { getPublicInvoiceById } from "@/lib/queries";
import { generateInvoicePdf } from "@/lib/pdf/invoice";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
