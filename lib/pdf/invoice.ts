import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { Business, Customer, Invoice, InvoiceItem } from "@/lib/types";
import { currency, formatDate } from "@/lib/utils";

type InvoicePdfPayload = {
  business: Pick<
    Business,
    "name" | "address" | "email" | "phone" | "payment_instructions"
  >;
  customer: Pick<Customer, "name" | "email" | "phone" | "address">;
  invoice: Pick<Invoice, "invoice_number" | "created_at" | "due_date" | "total">;
  items: Pick<InvoiceItem, "description" | "quantity" | "price" | "subtotal">[];
};

export async function generateInvoicePdf(payload: InvoicePdfPayload) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 48;
  const brand = rgb(0.16, 0.34, 0.92);
  const ink = rgb(0.09, 0.12, 0.18);
  const muted = rgb(0.43, 0.48, 0.55);
  const border = rgb(0.87, 0.9, 0.94);
  const white = rgb(1, 1, 1);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = height - margin;

  page.drawRectangle({
    x: margin,
    y: y - 74,
    width: width - margin * 2,
    height: 74,
    color: rgb(0.97, 0.98, 1)
  });

  page.drawRectangle({
    x: width - margin - 68,
    y: y - 58,
    width: 44,
    height: 44,
    color: brand,
    opacity: 0.12
  });

  page.drawText(payload.business.name, {
    x: margin,
    y: y - 26,
    size: 22,
    font: fontBold,
    color: ink
  });

  page.drawText("Invoice", {
    x: margin,
    y: y - 48,
    size: 12,
    font: font,
    color: muted
  });

  page.drawText("Logo", {
    x: width - margin - 54,
    y: y - 41,
    size: 14,
    font: fontBold,
    color: brand
  });

  y -= 108;

  const businessLines = [
    payload.business.address,
    payload.business.email,
    payload.business.phone
  ].filter(Boolean) as string[];

  const customerLines = [
    payload.customer.name,
    payload.customer.email,
    payload.customer.phone,
    payload.customer.address
  ].filter(Boolean) as string[];

  drawInfoBlock(page, {
    x: margin,
    y,
    title: "From",
    lines: [payload.business.name, ...businessLines],
    font,
    fontBold,
    ink,
    muted
  });

  drawInfoBlock(page, {
    x: width / 2,
    y,
    title: "Bill to",
    lines: customerLines,
    font,
    fontBold,
    ink,
    muted
  });

  y -= 100;

  drawMetaRow(page, {
    x: margin,
    y,
    label: "Invoice number",
    value: payload.invoice.invoice_number,
    font,
    fontBold,
    ink,
    muted
  });
  drawMetaRow(page, {
    x: margin + 180,
    y,
    label: "Invoice date",
    value: formatDate(payload.invoice.created_at),
    font,
    fontBold,
    ink,
    muted
  });
  drawMetaRow(page, {
    x: margin + 360,
    y,
    label: "Due date",
    value: formatDate(payload.invoice.due_date),
    font,
    fontBold,
    ink,
    muted
  });

  y -= 46;

  const columns = {
    description: margin,
    quantity: margin + 280,
    price: margin + 360,
    total: margin + 450
  };

  page.drawRectangle({
    x: margin,
    y: y - 20,
    width: width - margin * 2,
    height: 26,
    color: rgb(0.97, 0.98, 1),
    borderColor: border,
    borderWidth: 1
  });

  ["Description", "Quantity", "Price", "Total"].forEach((label, index) => {
    const x = [
      columns.description,
      columns.quantity,
      columns.price,
      columns.total
    ][index];

    page.drawText(label, {
      x,
      y: y - 10,
      size: 10,
      font: fontBold,
      color: muted
    });
  });

  y -= 38;

  payload.items.forEach((item) => {
    page.drawLine({
      start: { x: margin, y: y + 8 },
      end: { x: width - margin, y: y + 8 },
      thickness: 1,
      color: border
    });

    page.drawText(item.description, {
      x: columns.description,
      y,
      size: 11,
      font,
      color: ink
    });
    page.drawText(String(item.quantity), {
      x: columns.quantity,
      y,
      size: 11,
      font,
      color: ink
    });
    page.drawText(currency(Number(item.price)), {
      x: columns.price,
      y,
      size: 11,
      font,
      color: ink
    });
    page.drawText(currency(Number(item.subtotal)), {
      x: columns.total,
      y,
      size: 11,
      font: fontBold,
      color: ink
    });

    y -= 28;
  });

  y -= 14;

  page.drawRectangle({
    x: width - margin - 180,
    y: y - 44,
    width: 180,
    height: 44,
    color: ink
  });

  page.drawText("Total due", {
    x: width - margin - 156,
    y: y - 18,
    size: 11,
    font,
    color: white
  });
  page.drawText(currency(Number(payload.invoice.total)), {
    x: width - margin - 156,
    y: y - 34,
    size: 16,
    font: fontBold,
    color: white
  });

  y -= 94;

  page.drawText("Payment instructions", {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: ink
  });
  page.drawText(
    payload.business.payment_instructions ??
      "Please make payment by the due date and use the invoice number as your reference.",
    {
      x: margin,
      y: y - 18,
      size: 10,
      font,
      color: muted,
      maxWidth: width - margin * 2,
      lineHeight: 14
    }
  );

  return pdf.save();
}

function drawInfoBlock(
  page: PDFPage,
  {
    x,
    y,
    title,
    lines,
    font,
    fontBold,
    ink,
    muted
  }: {
    x: number;
    y: number;
    title: string;
    lines: string[];
    font: PDFFont;
    fontBold: PDFFont;
    ink: RGB;
    muted: RGB;
  }
) {
  page.drawText(title, {
    x,
    y,
    size: 10,
    font: fontBold,
    color: muted
  });

  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - 18 - index * 14,
      size: 11,
      font,
      color: ink
    });
  });
}

function drawMetaRow(
  page: PDFPage,
  {
    x,
    y,
    label,
    value,
    font,
    fontBold,
    ink,
    muted
  }: {
    x: number;
    y: number;
    label: string;
    value: string;
    font: PDFFont;
    fontBold: PDFFont;
    ink: RGB;
    muted: RGB;
  }
) {
  page.drawText(label, {
    x,
    y,
    size: 10,
    font,
    color: muted
  });
  page.drawText(value, {
    x,
    y: y - 16,
    size: 12,
    font: fontBold,
    color: ink
  });
}
