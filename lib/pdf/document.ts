import { PDFDocument, type PDFImage, type PDFPage, rgb, type RGB } from "pdf-lib";
import type { Business, Customer } from "@/lib/types";
import { currency } from "@/lib/utils";
import { logWarn } from "@/lib/observability";
import { createPdfText } from "./text";

export type DocumentIdentity = {
  business: Pick<Business, "name" | "address" | "email" | "phone" | "vat_number" |
    "registration_number" | "bank_name" | "bank_account_name" | "bank_account_number" |
    "bank_branch_code" | "payment_instructions" | "logo_url">;
  customer: Pick<Customer, "name" | "email" | "phone" | "address">;
};
type DocumentOptions = DocumentIdentity & {
  kind: "Invoice" | "Quote";
  void?: boolean;
  metadata: [string, string][];
  items: { description: string; quantity: number; price: number; subtotal: number }[];
  total: number;
  notes: string;
};

const width = 595.28, height = 841.89, margin = 48, bottom = 52;
const brand = rgb(0.16, 0.34, 0.92), ink = rgb(0.09, 0.12, 0.18);
const muted = rgb(0.43, 0.48, 0.55), border = rgb(0.87, 0.9, 0.94);
const pale = rgb(0.97, 0.98, 1), white = rgb(1, 1, 1);
const columns = [margin, margin + 280, margin + 360, margin + 450];

// Rendering only: values have already been selected from the document/snapshot.
// Never consult current catalogue prices or derive a total here.
export async function generateDocumentPdf(options: DocumentOptions) {
  const pdf = await PDFDocument.create();
  const { business, customer } = options;
  const text = await createPdfText(pdf, [
    business.name, business.address ?? "", business.email ?? "", business.phone ?? "",
    business.registration_number ?? "", business.vat_number ?? "",
    ...(!options.void ? [business.bank_name, business.bank_account_name, business.bank_account_number,
      business.bank_branch_code, options.notes].map((value) => value ?? "") : []),
    customer.name, customer.address ?? "", customer.email ?? "", customer.phone ?? "",
    ...options.metadata.map(([, value]) => value), ...options.items.map((item) => item.description)
  ]);
  const logo = await loadLogo(pdf, business.logo_url, options.kind);
  let page!: PDFPage;
  let y = 0;
  const draw = (value: string, x: number, baseline: number, size = 11, strong = false, color: RGB = ink) => {
    for (const run of text.runs(value, strong)) {
      page.drawText(run.value, { x, y: baseline, size, font: run.font, color });
      x += run.font.widthOfTextAtSize(run.value, size);
    }
  };
  // Keep the original header dimensions for ordinary names. Longer names get
  // measured space; exceptionally long names use a smaller header font.
  let nameSize = 22;
  let nameLines = text.wrap(business.name, width - margin * 2 - 90, nameSize, true);
  while (nameLines.length * (nameSize + 4) > 160) {
    nameSize *= 0.9;
    nameLines = text.wrap(business.name, width - margin * 2 - 90, nameSize, true);
  }
  const extraHeader = Math.max(0, nameLines.length * (nameSize + 4) - 26);
  const headerBottom = height - margin - 108 - extraHeader;
  function newPage() {
    page = pdf.addPage([width, height]);
    const top = height - margin;
    page.drawRectangle({ x: margin, y: top - 74 - extraHeader, width: width - margin * 2, height: 74 + extraHeader, color: pale });
    page.drawRectangle({ x: width - margin - 68, y: top - 58, width: 44, height: 44, color: brand, opacity: 0.12 });
    if (logo) {
      const scale = Math.min(44 / logo.width, 44 / logo.height);
      page.drawImage(logo, { x: width - margin - 68 + (44 - logo.width * scale) / 2,
        y: top - 58 + (44 - logo.height * scale) / 2, width: logo.width * scale, height: logo.height * scale });
    } else if (!business.logo_url) draw("Logo", width - margin - 54, top - 41, 14, true, brand);
    nameLines.forEach((line, index) => draw(line, margin, top - 26 - index * (nameSize + 4), nameSize, true));
    draw(options.void ? "VOID - NOT PAYABLE" : options.kind, margin, top - 48 - extraHeader, 12, false, muted);
    y = headerBottom;
    if (pdf.getPageCount() > 1) {
      // Identify detached continuation pages with the existing document reference.
      draw(options.metadata[0][1], margin, y, 12, true);
      y -= 30;
    }
  }
  function ensure(space: number) { if (y - space < bottom) newPage(); }
  newPage();

  const left = [business.name, business.address, business.email, business.phone,
    business.registration_number ? `Registration: ${business.registration_number}` : null,
    business.vat_number ? `VAT: ${business.vat_number}` : null].filter((value): value is string => Boolean(value))
    .flatMap((value) => text.wrap(value, width / 2 - margin - 20, 11));
  const right = [customer.name, customer.email, customer.phone, customer.address]
    .filter((value): value is string => Boolean(value)).flatMap((value) => text.wrap(value, width / 2 - margin, 11));
  let offset = 0;
  const infoLength = Math.max(left.length, right.length);
  do {
    const start = y;
    draw("From", margin, y, 10, true, muted);
    draw(options.kind === "Invoice" ? "Bill to" : "Quoted for", width / 2, y, 10, true, muted);
    const count = Math.min(infoLength - offset, Math.floor((y - 18 - bottom) / 14) + 1);
    for (let index = 0; index < count; index++) {
      draw(left[offset + index] ?? "", margin, y - 18 - index * 14);
      draw(right[offset + index] ?? "", width / 2, y - 18 - index * 14);
    }
    offset += count;
    y = start - Math.max(100, 18 + count * 14 + 12);
    if (offset < infoLength) newPage();
  } while (offset < infoLength);

  const metaLines = options.metadata.map(([, value], index) => text.wrap(value, index === 2 ? width - margin * 2 - 360 : 164, 12, true));
  const metaHeight = 30 + Math.max(...metaLines.map((lines) => lines.length)) * 16;
  ensure(metaHeight + 38 + 28);
  options.metadata.forEach(([label], index) => {
    draw(label, margin + index * 180, y, 10, false, muted);
    metaLines[index].forEach((line, row) => draw(line, margin + index * 180, y - 16 - row * 16, 12, true));
  });
  y -= metaHeight;

  function tableHeader() {
    page.drawRectangle({ x: margin, y: y - 20, width: width - margin * 2, height: 26, color: pale, borderColor: border, borderWidth: 1 });
    ["Description", "Quantity", "Price", "Total"].forEach((label, index) => draw(label, columns[index], y - 10, 10, true, muted));
    y -= 38;
  }
  function tablePage() { newPage(); tableHeader(); }
  tableHeader();
  const fullRowCapacity = Math.floor((headerBottom - 30 - 38 - bottom - 14) / 14);
  for (const item of options.items) {
    const lines = text.wrap(item.description, columns[1] - columns[0] - 12, 11);
    const rowHeight = Math.max(28, lines.length * 14 + 14);
    if (y - rowHeight < bottom && lines.length <= fullRowCapacity) tablePage();
    let lineIndex = 0;
    do {
      if (y - 28 < bottom) tablePage();
      const count = Math.min(lines.length - lineIndex, Math.floor((y - bottom - 14) / 14));
      page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 1, color: border });
      for (let i = 0; i < count; i++) draw(lines[lineIndex + i], margin, y - i * 14);
      if (lineIndex === 0) {
        [String(item.quantity), currency(Number(item.price)), currency(Number(item.subtotal))].forEach((value, index) => {
          const x = columns[index + 1];
          const available = (columns[index + 2] ?? width - margin) - x - (index === 2 ? 0 : 8);
          const size = Math.min(11, 11 * available / text.measure(value, 11, index === 2));
          draw(value, x, y, size, index === 2);
        });
      }
      y -= Math.max(28, count * 14 + 14);
      lineIndex += count;
      if (lineIndex < lines.length) tablePage();
    } while (lineIndex < lines.length);
  }

  ensure(14 + 44);
  y -= 14;
  page.drawRectangle({ x: width - margin - 180, y: y - 44, width: 180, height: 44, color: ink });
  draw(options.void ? "Original total (void)" : options.kind === "Invoice" ? "Total due" : "Quote total",
    width - margin - 156, y - 18, 11, false, white);
  const total = currency(Number(options.total));
  draw(total, width - margin - 156, y - 34, Math.min(16, 16 * 144 / text.measure(total, 16, true)), true, white);
  y -= 94;

  function paragraph(lines: string[], strong = false, color = muted) {
    for (const line of lines) { ensure(0); draw(line, margin, y, 10, strong, color); y -= 14; }
  }
  function section(title: string, values: string[]) {
    const lines = values.flatMap((value) => text.wrap(value, width - margin * 2, 10));
    // Keep normal sections together; long sections continue without clipping.
    ensure(Math.min(18 + lines.length * 14, headerBottom - 30 - bottom));
    draw(title, margin, y, 11, true);
    y -= 18;
    paragraph(lines);
    y -= 14;
  }
  if (options.void) {
    const lines = text.wrap("VOID - NOT PAYABLE. Retained for your records. Do not pay this invoice.", width - margin * 2, 10, true);
    ensure(lines.length * 14);
    paragraph(lines, true, ink);
  } else {
    const banking = [business.bank_name ? `Bank: ${business.bank_name}` : null,
      business.bank_account_name ? `Account name: ${business.bank_account_name}` : null,
      business.bank_account_number ? `Account number: ${business.bank_account_number}` : null,
      business.bank_branch_code ? `Branch code: ${business.bank_branch_code}` : null]
      .filter((value): value is string => Boolean(value));
    if (banking.length) section("Banking details", banking);
    section(options.kind === "Invoice" ? "Payment instructions" : "Notes", [options.notes]);
  }
  return pdf.save();
}

async function loadLogo(pdf: PDFDocument, url: string | null, kind: string): Promise<PDFImage | undefined> {
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) { logWarn(`${kind} PDF logo fetch failed`, { status: response.status }); return; }
    const bytes = await response.arrayBuffer();
    try { return await pdf.embedPng(bytes); } catch { return await pdf.embedJpg(bytes); }
  } catch (error) {
    logWarn(`${kind} PDF logo embed failed`, { error: error instanceof Error ? error.message : String(error) });
  }
}
