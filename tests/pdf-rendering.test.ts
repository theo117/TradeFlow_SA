import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateInvoicePdf } from "../lib/pdf/invoice";
import { generateQuotePdf } from "../lib/pdf/quote";
import { currency } from "../lib/utils";

function fixture() {
  return {
    business: { name: "Example Services", address: "12 Main Road", email: "office@example.test", phone: "011 123 4567",
      vat_number: null, registration_number: null, bank_name: "Example Bank", bank_account_name: "Example Services",
      bank_account_number: "123456789", bank_branch_code: "123456", payment_instructions: "Use the document reference when paying.", logo_url: null },
    customer: { name: "Example Customer", address: "34 Customer Road", email: "customer@example.test", phone: "082 123 4567" },
    items: [{ description: "Agreed service", quantity: 2, price: 100, subtotal: 200 }],
    invoice: { invoice_number: "INV-000123", created_at: "2026-01-01", due_date: "2026-01-15", status: "sent" as "sent" | "void", total: 200 },
    quote: { id: "12345678-0000", created_at: "2026-01-01", status: "sent" as const, total: 200 }
  };
}
const hasPoppler = spawnSync("pdftotext", ["-v"]).status === 0;
function extract(bytes: Uint8Array) {
  const dir = mkdtempSync(path.join(tmpdir(), "h15-extract-"));
  try {
    writeFileSync(path.join(dir, "document.pdf"), bytes);
    const extraction = spawnSync("pdftotext", ["-layout", path.join(dir, "document.pdf"), path.join(dir, "document.txt")], { encoding: "utf8" });
    expect(extraction.status).toBe(0); expect(extraction.stderr).toBe("");
    // Text extraction alone can pass even when a viewer cannot render an
    // embedded font. Check the rasterizer too whenever Poppler is installed.
    if (spawnSync("pdftoppm", ["-v"]).status === 0) {
      const raster = spawnSync("pdftoppm", ["-scale-to", "200", "-singlefile", "-png", path.join(dir, "document.pdf"), path.join(dir, "page")], { encoding: "utf8" });
      expect(raster.status).toBe(0); expect(raster.stderr).toBe("");
    }
    return readFileSync(path.join(dir, "document.txt"), "utf8");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function assertVisibleGlyphs(bytes: Uint8Array, value: string, x: number, y: number, size: number) {
  const dir = mkdtempSync(path.join(tmpdir(), "h15-glyphs-"));
  try {
    writeFileSync(path.join(dir, "document.pdf"), bytes);
    const raster = spawnSync("pdftoppm", ["-r", "144", "-gray", "-singlefile", path.join(dir, "document.pdf"), path.join(dir, "glyphs")], { encoding: "utf8" });
    expect(raster.status).toBe(0); expect(raster.stderr).toBe("");
    const pgm = readFileSync(path.join(dir, "glyphs.pgm"));
    const header = pgm.toString("ascii", 0, 100).match(/^P5\s+(\d+)\s+(\d+)\s+255\s/)!;
    expect(header).not.toBeNull();
    const stride = Number(header[1]); const pixels = pgm.subarray(header[0].length);
    // These full-width CJK glyphs must have actual dark outline pixels. Broken
    // font subsets can extract correctly and rasterize without warnings.
    for (let index = 0; index < Array.from(value).length; index++) {
      let ink = 0;
      for (let row = Math.floor((841.89 - y - size) * 2); row < Math.ceil((841.89 - y + size * 0.1) * 2); row++) {
        for (let col = Math.ceil((x + index * size) * 2); col < Math.floor((x + (index + 1) * size) * 2); col++) {
          if (pixels[row * stride + col] < 100) ink++;
        }
      }
      expect(ink, `visible glyph ${Array.from(value)[index]}`).toBeGreaterThan(10);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
afterEach(() => vi.restoreAllMocks());

for (const kind of ["invoice", "quote"] as const) {
  describe(`${kind} PDF layout`, () => {
    async function render(data = fixture(), artifact?: string) {
      const before = JSON.stringify(data);
      const draw = vi.spyOn(PDFPage.prototype, "drawText");
      const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Tests must not fetch fonts"));
      const bytes = await (kind === "invoice" ? generateInvoicePdf(data) : generateQuotePdf(data));
      expect(fetch).not.toHaveBeenCalled();
      expect(JSON.stringify(data)).toBe(before);
      const pdf = await PDFDocument.load(bytes);
      for (const [value, options] of draw.mock.calls) {
        expect(options!.y, value).toBeGreaterThanOrEqual(52);
        expect(options!.y! + options!.size!, value).toBeLessThanOrEqual(793.89);
        expect(options!.x!, value).toBeGreaterThanOrEqual(48);
        expect(options!.x! + options!.font!.widthOfTextAtSize(value, options!.size!), value).toBeLessThanOrEqual(547.281);
      }
      const output = process.env.PDF_TEST_OUTPUT_DIR;
      if (artifact && output) {
        if (!output.startsWith("/tmp/")) throw new Error("Use a disposable /tmp PDF artifact directory");
        mkdirSync(output, { recursive: true }); writeFileSync(path.join(output, `${kind}-${artifact}.pdf`), bytes);
      }
      return { bytes, pages: pdf.getPageCount(), calls: draw.mock.calls, text: draw.mock.calls.map(([value]) => value).join("\n") };
    }
    it("keeps a normal one-item document on one page with the original Helvetica styling", async () => {
      const result = await render(fixture(), "simple");
      expect(result.pages).toBe(1);
      const business = result.calls.find(([value]) => value === "Example Services")!;
      expect(business[1]).toMatchObject({ x: 48, y: 767.89, size: 22 });
      expect(business[1]!.font!.name).toBe("Helvetica-Bold");
      expect(result.text).toContain(currency(200));
      expect(result.text).toContain("Use the document reference when paying.");
    });
    it("preserves Chinese names and non-Latin descriptions in the actual PDF text", async () => {
      const data = fixture(); data.business.name = "北京服务公司"; data.customer.name = "张伟";
      data.items[0].description = "安装服务 日本語 한국어 Ελληνικά Кириллица";
      const result = await render(data, "unicode");
      expect(result.bytes.length).toBeLessThan(100_000);
      for (const value of ["北京服务公司", "张伟", "安装服务", "日本語", "한국어", "Ελληνικά", "Кириллица"]) expect(result.text).toContain(value);
      if (hasPoppler) {
        const extracted = extract(result.bytes);
        for (const value of ["北京服务公司", "张伟", "安装服务", "日本語", "한국어", "Ελληνικά", "Кириллица"]) expect(extracted).toContain(value);
        expect(extracted).not.toContain("?");
        if (spawnSync("pdftoppm", ["-v"]).status === 0) {
          for (const value of ["北京服务公司", "张伟"]) {
            const [, options] = result.calls.find(([drawn]) => drawn === value)!;
            assertVisibleGlyphs(result.bytes, value, options!.x!, options!.y!, options!.size!);
          }
        }
      }
    });
    it("paginates 30 items, repeats table headings and retains final sections and persisted amounts", async () => {
      const data = fixture();
      data.items = Array.from({ length: 30 }, (_, index) => ({ description: `Service ${index + 1}`, quantity: 2, price: 123.45, subtotal: 246.90 }));
      // Deliberately distinct header value: rendering must not derive a new total.
      data.invoice.total = data.quote.total = 9876.54;
      const result = await render(data, "thirty-items");
      expect(result.pages).toBe(3);
      for (const item of data.items) expect(result.text).toContain(item.description);
      expect(result.calls.filter(([value]) => value === "Description").length).toBe(2);
      expect(result.calls.filter(([value]) => value === currency(246.9))).toHaveLength(30);
      expect(result.calls.filter(([value]) => value === currency(123.45))).toHaveLength(30);
      expect(result.text).toContain(currency(9876.54));
      expect(result.text).toContain("Bank: Example Bank");
      expect(result.text).toContain("Use the document reference when paying.");
      if (hasPoppler) {
        const extracted = extract(result.bytes);
        expect(extracted).toContain("Service 30"); expect(extracted).toContain("Use the document reference when paying.");
      }
    });
    it("expands wrapped rows without overlapping the numeric columns or following row", async () => {
      const data = fixture(); data.items[0].description = "Long service description with detailed scope and agreed work. ".repeat(8);
      data.items.push({ description: "Following row", quantity: 1, price: 50, subtotal: 50 });
      const result = await render(data, "wrapped");
      const wrapped = result.calls.filter(([value]) => value.includes("scope") || value.includes("Long service") || value.includes("agreed work"));
      expect(wrapped.length).toBeGreaterThan(5);
      for (const [value, options] of wrapped) {
        expect(options!.x! + options!.font!.widthOfTextAtSize(value, options!.size!)).toBeLessThanOrEqual(316);
      }
      const following = result.calls.find(([value]) => value === "Following row")!;
      expect(following[1]!.y).toBeLessThan(wrapped.at(-1)![1]!.y! - 14);
    });
    it("wraps long addresses and moves metadata below both address blocks", async () => {
      const data = fixture(); data.business.address = "Business address with many street and building details ".repeat(6);
      data.customer.address = "Customer address with many street and building details ".repeat(7);
      const result = await render(data, "addresses");
      const addresses = result.calls.filter(([value]) => /address|street|building|details/.test(value) && !value.includes("Banking"));
      expect(addresses.length).toBeGreaterThan(10);
      for (const [value, options] of addresses) {
        const end = options!.x! + options!.font!.widthOfTextAtSize(value, options!.size!);
        expect(end).toBeLessThanOrEqual(options!.x === 48 ? 277.64 : 547.28);
      }
      const metadata = result.calls.find(([value]) => value === (kind === "invoice" ? "Invoice number" : "Quote reference"))!;
      expect(metadata[1]!.y).toBeLessThan(Math.min(...addresses.map(([, options]) => options!.y!)) - 14);
    });
    it("continues a row taller than a page and multi-page notes without dropping their endings", async () => {
      const data = fixture(); data.items[0].description = "LongDetailedServiceWithoutSpaces".repeat(120) + " END-OF-ROW";
      data.business.payment_instructions = "Long payment note with explicit instructions. ".repeat(250) + " END-OF-NOTES";
      const result = await render(data, "oversized");
      expect(result.pages).toBeGreaterThan(3);
      expect(result.text).toContain("END-OF-ROW"); expect(result.text).toContain("END-OF-NOTES");
      expect(result.calls.filter(([value]) => value === currency(100))).toHaveLength(1);
    });
    it("handles addresses spanning pages and unusually large persisted currency values", async () => {
      const data = fixture(); data.customer.address = "Apartment and building street district province ".repeat(200);
      data.items[0].price = data.items[0].subtotal = data.invoice.total = data.quote.total = 9999999999.99;
      const result = await render(data);
      expect(result.pages).toBeGreaterThan(2); expect(result.text).toContain(currency(9999999999.99));
    });
    it("rejects missing glyphs explicitly instead of silently replacing content", async () => {
      const data = fixture(); data.customer.name = "Unsupported \u{10FFFF}";
      await expect(kind === "invoice" ? generateInvoicePdf(data) : generateQuotePdf(data)).rejects.toThrow("U+10FFFF");
    });
  });
}

it("keeps a long void invoice NOT PAYABLE on every page without banking or payment instructions", async () => {
  const data = fixture(); data.invoice.status = "void";
  data.items = Array.from({ length: 30 }, (_, index) => ({ ...data.items[0], description: `Agreed service ${index}` }));
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  const bytes = await generateInvoicePdf(data);
  const text = draw.mock.calls.map(([value]) => value).join("\n");
  const pages = (await PDFDocument.load(bytes)).getPageCount();
  expect(draw.mock.calls.filter(([value]) => value === "VOID - NOT PAYABLE")).toHaveLength(pages);
  expect(text).toContain("Original total (void)"); expect(text).toContain("Do not pay this invoice.");
  expect(text).not.toContain("Banking details"); expect(text).not.toContain("123456789");
  expect(text).not.toContain("Payment instructions"); expect(text).not.toContain(data.business.payment_instructions);
});
