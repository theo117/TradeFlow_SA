import { NextResponse } from "next/server";
import { getPublicQuoteById } from "@/lib/queries";
import { generateQuotePdf } from "@/lib/pdf/quote";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
