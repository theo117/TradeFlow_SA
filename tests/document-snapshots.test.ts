import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PDFPage } from "pdf-lib";
import { Pool } from "pg";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../lib/db/schema";

const state = vi.hoisted(() => ({ db: undefined as unknown as PostgresJsDatabase<typeof schema>, businessId: "", userId: "", logoUrl: null as string | null }));
vi.mock("@/lib/auth", () => ({
  requirePaidBusiness: async () => ({ id: state.businessId, owner_id: state.userId }),
  requireBusiness: async () => ({ id: state.businessId, owner_id: state.userId, logo_url: state.logoUrl }),
  hasBillingAccess: () => true
}));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (original) => ({ ...await original<typeof import("next/navigation")>(), useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@vercel/blob", () => ({ del: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/whatsapp", () => ({
  sendInvoiceWhatsappMessage: vi.fn(), sendQuoteWhatsappMessage: vi.fn(), parseWhatsappDeliveryState: () => null,
  resolveCustomerWhatsappPhone: () => "27820000000", normalizeWhatsappPhone: (phone: string) => phone
}));
import { del } from "@vercel/blob";
import { voidInvoice, updateInvoiceStatus, recordInvoiceReminder, convertQuoteToInvoice } from "../app/dashboard/invoices/actions";
import { createQuote, updateQuoteStatus, sendQuoteViaWhatsapp } from "../app/dashboard/quotes/actions";
import { acceptQuote } from "../app/quote/actions";
import { updateBusinessProfile } from "../app/dashboard/settings/actions";
import { sendInvoiceWhatsappMessage, sendQuoteWhatsappMessage } from "../lib/whatsapp";
import { getInvoiceById, getPublicInvoiceById, getQuoteById, getPublicQuoteById } from "../lib/queries";
import { syncOverdueInvoices } from "../lib/invoices";
import PublicInvoicePage from "../app/invoice/[id]/page";
import PublicQuotePage from "../app/quote/[id]/page";
import { InvoiceDocument } from "../components/dashboard/invoice-document";
import { QuoteDocument } from "../components/dashboard/quote-document";
import { GET as invoicePdf } from "../app/api/invoices/[id]/pdf/route";
import { GET as quotePdf } from "../app/api/quotes/[id]/pdf/route";
import { GET as invoiceCsv } from "../app/api/export/invoices/route";

const execute = promisify(execFile);
const adminUrl = process.env.DOCUMENT_TEST_ADMIN_URL;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const token = "synthetic-h11-token";

describe.skipIf(!adminUrl)("historical document snapshots (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  let pool: Pool;
  let client: ReturnType<typeof postgres>;
  let fixture: string;
  let name: string;
  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h11_test_admin") throw new Error("Use only disposable localhost PostgreSQL with database h11_test_admin.");
    admin = new Pool({ connectionString: url.href });
    const version = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    expect(version).toBeGreaterThanOrEqual(170000);
    expect(version).toBeLessThan(180000);
    fixture = `h11_fixture_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${fixture}"`);
    url.pathname = `/${fixture}`;
    await execute("npm", ["run", "db:migrate"], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href }, timeout: 30000
    });
  }, 30000);
  beforeEach(async () => {
    name = `h11_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${fixture}"`);
    const url = new URL(adminUrl!); url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.href });
    await pool.query("INSERT INTO users(id,email,password_hash) VALUES ($1,'one@example.test','synthetic'),($2,'two@example.test','synthetic')", [id(1), id(2)]);
    await pool.query("INSERT INTO businesses(id,owner_id,name,bank_account_number,payment_instructions) VALUES ($1,$2,'One','synthetic-bank','Synthetic payment instruction'),($3,$4,'Two',null,null)", [id(3), id(1), id(4), id(2)]);
    await pool.query("INSERT INTO customers(id,business_id,name) VALUES ($1,$2,'One customer'),($3,$4,'Two customer')", [id(5), id(3), id(6), id(4)]);
    await pool.query("INSERT INTO quotes(id,business_id,customer_id,status,total) VALUES ($1,$2,$3,'accepted',123.45)", [id(7), id(3), id(5)]);
    await pool.query("INSERT INTO recurring_invoice_templates(id,business_id,customer_id,name,description,frequency,total,next_invoice_date) VALUES ($1,$2,$3,'Retainer','Agreed recurring amount','monthly',123.45,'2099-02-15')", [id(8), id(3), id(5)]);
    for (const [n, status] of ["draft", "sent", "overdue", "paid"].entries()) {
      await pool.query(`INSERT INTO invoices(id,business_id,customer_id,status,total,due_date,quote_id,recurring_template_id,recurring_period)
        VALUES ($1,$2,$3,$4,123.45,'2099-01-22',$5,$6,$7)`,
      [id(10+n), id(3), id(5), status, n === 1 ? id(7) : null, n === 2 ? id(8) : null, n === 2 ? "2099-01-15" : null]);
      await pool.query("INSERT INTO invoice_items(invoice_id,description,quantity,price,subtotal) VALUES ($1,'Original service',1,123.45,123.45)", [id(10+n)]);
    }
    await pool.query("INSERT INTO invoices(id,business_id,customer_id,status,total,due_date) VALUES ($1,$2,$3,'sent',999,'2099-01-22')", [id(20), id(4), id(6)]);
    await pool.query("INSERT INTO invoices(id,business_id,customer_id,status,total,due_date) VALUES ($1,$2,$3,'draft',100,'2099-01-22')", [id(21), id(4), id(6)]);
    await pool.query("INSERT INTO public_share_tokens(business_id,invoice_id,document_type,token_hash,expires_at) VALUES ($1,$2,'invoice',$3,now()+interval '1 day')", [id(3), id(11), createHash("sha256").update(token).digest("hex")]);
    client = postgres(url.href, { prepare: false, max: 4, connection: { application_name: "h11_mutations" } });
    state.db = drizzle(client, { schema }); state.businessId = id(3); state.userId = id(1);
    vi.mocked(sendInvoiceWhatsappMessage).mockResolvedValue({ ok: true, delivery: "cloud", message: "Synthetic" });
    vi.mocked(sendQuoteWhatsappMessage).mockResolvedValue({ ok: true, delivery: "cloud", message: "Synthetic" });
    await pool.query("UPDATE businesses SET email='business-before@example.test',address='Business original address',phone='0111111111',vat_number='VAT-before',registration_number='REG-before',bank_name='Original bank',bank_account_name='Original account',bank_branch_code='123456' WHERE id=$1", [id(3)]);
    await pool.query("UPDATE customers SET email='customer-before@example.test',address='Customer original address',phone='0222222222' WHERE id=$1", [id(5)]);
    await pool.query("INSERT INTO services(id,business_id,name,description,price) VALUES ($1,$2,'Service A','Description A',100),($3,$4,'Foreign service','Foreign description',999)", [id(31),id(3),id(32),id(4)]);
    await pool.query("INSERT INTO quotes(id,business_id,customer_id,status,total) VALUES ($1,$2,$3,'draft',200)", [id(30),id(3),id(5)]);
    await pool.query("INSERT INTO quote_items(id,quote_id,service_id,quantity,price,subtotal) VALUES ($1,$2,$3,2,100,200)", [id(33),id(30),id(31)]);
    vi.mocked(del).mockClear();
    state.logoUrl = null;
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (client) await client.end();
    if (pool) await pool.end();
    if (name) {
      await vi.waitFor(async () => expect((await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1", [name])).rows[0].count).toBe(0), { timeout: 5000, interval: 20 });
      await admin.query(`DROP DATABASE "${name}"`);
    }
  });
  afterAll(async () => { if (fixture) await admin.query(`DROP DATABASE "${fixture}"`); if (admin) await admin.end(); });

  async function row(table: "invoices" | "quotes", documentId: string) {
    return (await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE id=$1`, [documentId])).rows[0]?.row;
  }
  async function editLiveRecords() {
    await pool.query("UPDATE customers SET name='Customer AFTER',email='customer-after@example.test',phone='0999999999',address='Customer AFTER address' WHERE id=$1", [id(5)]);
    await pool.query("UPDATE businesses SET name='Business AFTER',email='business-after@example.test',phone='0888888888',address='Business AFTER address',vat_number='VAT-after',registration_number='REG-after',bank_name='Bank AFTER',bank_account_name='Account AFTER',bank_account_number='Account number AFTER',bank_branch_code='999999',payment_instructions='Instructions AFTER' WHERE id=$1", [id(3)]);
    await pool.query("UPDATE services SET name='Service B',description='Description B',price=999 WHERE id=$1", [id(31)]);
  }
  async function share(kind: "invoice" | "quote", documentId: string) {
    await pool.query(`INSERT INTO public_share_tokens(business_id,${kind}_id,document_type,token_hash,expires_at) VALUES ($1,$2,$3,$4,now()+interval '1 day')`,
      [id(3), documentId, kind, createHash("sha256").update(`${kind}-${documentId}`).digest("hex")]);
    return `${kind}-${documentId}`;
  }
  async function pdfText(kind: "invoice" | "quote", documentId: string) {
    const publicToken = await share(kind, documentId);
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const response = await (kind === "invoice" ? invoicePdf : quotePdf)(new Request(`http://localhost/api/${kind}s/${documentId}/pdf?token=${publicToken}`), { params: Promise.resolve({ id: documentId }) });
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    const text = draw.mock.calls.map(([value]) => value).join("\n"); draw.mockRestore();
    return text;
  }
  async function convert(quoteId = id(30)) {
    const data = new FormData(); data.set("quoteId", quoteId); data.set("dueDate", "2099-01-22");
    await expect(convertQuoteToInvoice(data)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    return (await pool.query("SELECT id FROM invoices WHERE quote_id=$1", [quoteId])).rows[0]?.id as string | undefined;
  }
  async function failOn(table: "invoices" | "quotes", condition: string) {
    await pool.query(`CREATE FUNCTION h11_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic H11 failure'; END $$;
      CREATE TRIGGER h11_fail AFTER UPDATE ON ${table} FOR EACH ROW WHEN (${condition}) EXECUTE FUNCTION h11_fail()`);
  }
  async function removeFailure(table: "invoices" | "quotes") {
    await pool.query(`DROP TRIGGER h11_fail ON ${table}; DROP FUNCTION h11_fail()`);
  }

  it("freezes invoice customer, business and payment details for private/public HTML, PDF and CSV", async () => {
    expect((await updateInvoiceStatus(id(10), "sent")).error).toBe(false);
    const before = await row("invoices", id(10));
    await editLiveRecords();
    const document = (await getInvoiceById(id(10)))!;
    expect(document).toEqual(await getPublicInvoiceById(id(10)));
    const html = renderToStaticMarkup(React.createElement(InvoiceDocument, { invoice: document, business: document.business, customer: document.customer }));
    const publicToken = await share("invoice", id(10));
    const publicHtml = renderToStaticMarkup(await PublicInvoicePage({ params: Promise.resolve({ id: id(10) }), searchParams: Promise.resolve({ token: publicToken }) }));
    // Reuse the token for the PDF to avoid a duplicate unique token hash.
    await pool.query("DELETE FROM public_share_tokens WHERE token_hash=$1", [createHash("sha256").update(publicToken).digest("hex")]);
    const pdf = await pdfText("invoice", id(10));
    for (const text of [html, publicHtml, pdf]) {
      for (const original of ["One customer", "customer-before@example.test", "Customer original address", "Business original address", "business-before@example.test", "Original bank", "synthetic-bank", "Synthetic payment instruction", "VAT-before", "REG-before"]) expect(text).toContain(original);
      expect(text).not.toContain("AFTER");
    }
    const csv = await (await invoiceCsv()).text();
    const line = csv.split("\n").find((line) => line.includes(before.invoice_number))!;
    expect(line).toContain("One customer"); expect(line).toContain("customer-before@example.test"); expect(line).not.toContain("AFTER");
    expect(await row("invoices", id(10))).toEqual(before);
  });

  it("keeps drafts live and freezes the values present at issuance, including explicit null fields", async () => {
    expect((await getPublicInvoiceById(id(10)))?.customer.name).toBe("One customer");
    await editLiveRecords();
    await pool.query("UPDATE customers SET email=null WHERE id=$1", [id(5)]);
    expect((await getPublicInvoiceById(id(10)))?.customer.name).toBe("Customer AFTER");
    expect((await row("invoices", id(10))).document_snapshot).toBeNull();
    expect((await updateInvoiceStatus(id(10), "sent")).error).toBe(false);
    await pool.query("UPDATE customers SET name='Third name',email='third@example.test' WHERE id=$1", [id(5)]);
    expect((await getPublicInvoiceById(id(10)))?.customer).toMatchObject({ name: "Customer AFTER", email: null });
    const csv = await (await invoiceCsv()).text();
    const invoiceNumber = (await row("invoices", id(10))).invoice_number;
    expect(csv.split("\n").find((line) => line.includes(invoiceNumber))).not.toContain("third@example.test");
  });

  it.each(["paid", "overdue", "void"] as const)("preserves the issued snapshot and amounts when subsequently %s", async (status) => {
    expect((await updateInvoiceStatus(id(10), "sent")).error).toBe(false);
    const before = await row("invoices", id(10));
    await editLiveRecords();
    const result = status === "void" ? await voidInvoice(id(10)) : await updateInvoiceStatus(id(10), status);
    expect(result.error).toBe(false);
    expect(await row("invoices", id(10))).toEqual({ ...before, status });
    expect((await getPublicInvoiceById(id(10)))?.customer.name).toBe("One customer");
    if (status === "void") {
      const document = (await getPublicInvoiceById(id(10)))!;
      const html = renderToStaticMarkup(React.createElement(InvoiceDocument, { invoice: document, business: document.business, customer: document.customer }));
      expect(html).toContain("One customer"); expect(html).toContain("Do not pay"); expect(html).not.toContain("synthetic-bank");
    }
  });

  it("preserves snapshots during the private overdue refresh", async () => {
    await pool.query("UPDATE invoices SET due_date='2000-01-01' WHERE id=$1", [id(10)]);
    expect((await updateInvoiceStatus(id(10), "sent")).error).toBe(false);
    const before = await row("invoices", id(10)); await editLiveRecords();
    await syncOverdueInvoices(id(3));
    expect(await row("invoices", id(10))).toEqual({ ...before, status: "overdue" });
  });

  it("freezes issued quote identity and both service wordings, then converts agreed values after catalogue edits", async () => {
    expect((await updateQuoteStatus(id(30), "sent")).error).toBe(false);
    const before = await row("quotes", id(30)); await editLiveRecords();
    const quote = (await getQuoteById(id(30)))!;
    expect(quote).toEqual(await getPublicQuoteById(id(30)));
    expect(quote.items[0].service).toMatchObject({ name: "Service A", description: "Description A" });
    const html = renderToStaticMarkup(React.createElement(QuoteDocument, { quote, business: quote.business, customer: quote.customer! }));
    expect(html).toContain("Service A"); expect(html).toContain("Description A"); expect(html).not.toContain("AFTER");
    const publicToken = await share("quote", id(30));
    const publicHtml = renderToStaticMarkup(await PublicQuotePage({ params: Promise.resolve({ id: id(30) }), searchParams: Promise.resolve({ token: publicToken }) }));
    expect(publicHtml).toContain("Service A"); expect(publicHtml).not.toContain("AFTER");
    const acceptance = new FormData(); acceptance.set("quoteId", id(30)); acceptance.set("token", publicToken);
    await expect(acceptQuote(acceptance)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(await row("quotes", id(30))).toEqual({ ...before, status: "accepted" });
    await pool.query("DELETE FROM public_share_tokens WHERE token_hash=$1", [createHash("sha256").update(publicToken).digest("hex")]);
    const pdf = await pdfText("quote", id(30)); expect(pdf).toContain("Service A"); expect(pdf).toContain("One customer"); expect(pdf).not.toContain("AFTER");
    const invoiceId = (await convert())!; expect(invoiceId).toBeDefined();
    const invoice = (await getPublicInvoiceById(invoiceId))!;
    expect(invoice).toMatchObject({ status: "draft", total: 200, customer: { name: "One customer" }, business: { name: "One" } });
    expect(invoice.items[0]).toMatchObject({ description: "Service A", quantity: 2, price: 100, subtotal: 200 });
    const inherited = (await row("invoices", invoiceId)).document_snapshot;
    expect((await updateInvoiceStatus(invoiceId, "sent")).error).toBe(false);
    expect((await row("invoices", invoiceId)).document_snapshot).toEqual(inherited);
  });

  it("captures quote creation with initial sent status atomically", async () => {
    const status = "sent";
    const data = new FormData(); data.set("customerId", id(5)); data.set("status", status);
    data.set("items", JSON.stringify([{ service_id: id(31), quantity: 2 }]));
    await expect(createQuote(data)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    const created = (await pool.query("SELECT id,document_snapshot,total::text FROM quotes WHERE id NOT IN ($1,$2)", [id(7),id(30)])).rows;
    expect(created).toHaveLength(1); expect(created[0].total).toBe("200.00");
    expect(created[0].document_snapshot.customer.name).toBe("One customer");
    expect(Object.values(created[0].document_snapshot.items)).toEqual([{ name: "Service A", description: "Description A" }]);
  });

  it("captures a direct draft-to-accepted quote transition and retains it on retry", async () => {
    expect((await updateQuoteStatus(id(30), "accepted")).error).toBe(false);
    const before = await row("quotes", id(30)); expect(before.document_snapshot).not.toBeNull();
    await editLiveRecords();
    expect((await updateQuoteStatus(id(30), "accepted")).error).toBe(false);
    expect(await row("quotes", id(30))).toEqual(before);
  });

  it("rolls back quote creation completely when initial issuance fails", async () => {
    await failOn("quotes", "NEW.status = 'sent'");
    const data = new FormData(); data.set("customerId", id(5)); data.set("status", "sent");
    data.set("items", JSON.stringify([{ service_id: id(31), quantity: 2 }]));
    await expect(createQuote(data)).rejects.toMatchObject({ digest: expect.stringContaining("/dashboard/quotes/new?error=") });
    expect((await pool.query("SELECT count(*)::int AS count FROM quotes")).rows[0].count).toBe(2);
    expect((await pool.query("SELECT count(*)::int AS count FROM quote_items")).rows[0].count).toBe(1);
    await removeFailure("quotes");
    await expect(createQuote(data)).rejects.toMatchObject({ digest: expect.stringContaining("success=Quote%20created") });
    expect((await pool.query("SELECT count(*)::int AS count FROM quotes WHERE document_snapshot IS NOT NULL")).rows[0].count).toBe(1);
  });

  it.each(["email", "whatsapp"] as const)("captures invoice issuance through %s reminder", async (channel) => {
    expect((await recordInvoiceReminder(id(10), channel)).error).toBe(false);
    const before = await row("invoices", id(10)); expect(before.status).toBe("sent"); expect(before.document_snapshot).not.toBeNull();
    await editLiveRecords(); expect((await recordInvoiceReminder(id(10), channel)).error).toBe(false);
    expect(await row("invoices", id(10))).toEqual(before);
  });

  it("captures WhatsApp quote issuance without overwriting on retry or return to draft", async () => {
    expect((await sendQuoteViaWhatsapp(id(30))).error).toBe(false);
    const before = await row("quotes", id(30)); expect(before.document_snapshot).not.toBeNull();
    await editLiveRecords(); expect((await sendQuoteViaWhatsapp(id(30))).error).toBe(false);
    expect((await updateQuoteStatus(id(30), "draft")).error).toBe(false);
    expect((await updateQuoteStatus(id(30), "sent")).error).toBe(false);
    expect(await row("quotes", id(30))).toEqual(before);
  });

  it("serializes repeated simultaneous issuance without overwriting the first snapshot", async () => {
    const results = await Promise.all([updateInvoiceStatus(id(10), "sent"), updateInvoiceStatus(id(10), "sent")]);
    expect(results.every((result) => !result.error)).toBe(true);
    const before = await row("invoices", id(10)); await editLiveRecords();
    expect((await updateInvoiceStatus(id(10), "sent")).error).toBe(false);
    expect(await row("invoices", id(10))).toEqual(before);
  });

  it.each(["invoices", "quotes"] as const)("rolls back snapshot and status if either write fails for %s", async (table) => {
    const documentId = table === "invoices" ? id(10) : id(30);
    const issue = () => table === "invoices" ? updateInvoiceStatus(documentId, "sent") : updateQuoteStatus(documentId, "sent");
    const before = await row(table, documentId);
    for (const condition of ["NEW.document_snapshot IS NOT NULL", "NEW.status = 'sent'"]) {
      await failOn(table, condition); expect((await issue()).error).toBe(true);
      expect(await row(table, documentId)).toEqual(before); await removeFailure(table);
    }
    expect((await issue()).error).toBe(false); expect((await row(table, documentId)).document_snapshot).not.toBeNull();
  });

  it("rejects foreign documents/customers/services without persisting snapshots or issuance", async () => {
    const foreign = await row("invoices", id(21));
    expect((await updateInvoiceStatus(id(21), "sent")).error).toBe(true);
    expect(await row("invoices", id(21))).toEqual(foreign);
    await pool.query("UPDATE invoices SET customer_id=$1 WHERE id=$2", [id(6),id(10)]);
    expect((await updateInvoiceStatus(id(10), "sent")).error).toBe(true);
    expect(await row("invoices", id(10))).toMatchObject({ status: "draft", document_snapshot: null });
    await pool.query("UPDATE quotes SET customer_id=$1 WHERE id=$2", [id(6),id(30)]);
    expect((await updateQuoteStatus(id(30), "sent")).error).toBe(true);
    expect(await convert()).toBeUndefined();
    await pool.query("UPDATE quotes SET customer_id=$1 WHERE id=$2", [id(5),id(30)]);
    await pool.query("UPDATE quote_items SET service_id=$1 WHERE quote_id=$2", [id(32),id(30)]);
    expect((await updateQuoteStatus(id(30), "sent")).error).toBe(true);
    expect(await row("quotes", id(30))).toMatchObject({ status: "draft", document_snapshot: null });
    expect(await convert()).toBeUndefined();
    state.businessId = id(4);
    expect((await updateQuoteStatus(id(30), "sent")).error).toBe(true);
  });

  it("renders legacy issued null snapshots with live fallback and does not fabricate snapshots on reads or later transitions", async () => {
    await pool.query("UPDATE quotes SET status='sent' WHERE id=$1", [id(30)]);
    await editLiveRecords();
    const invoiceBefore = await row("invoices", id(11)); const quoteBefore = await row("quotes", id(30));
    for (let n=0; n<2; n++) {
      expect((await getPublicInvoiceById(id(11)))?.customer.name).toBe("Customer AFTER");
      expect((await getPublicQuoteById(id(30)))?.items[0].service?.name).toBe("Service B");
    }
    expect(await row("invoices", id(11))).toEqual(invoiceBefore); expect(await row("quotes", id(30))).toEqual(quoteBefore);
    expect((await updateInvoiceStatus(id(11), "paid")).error).toBe(false);
    expect((await updateQuoteStatus(id(30), "accepted")).error).toBe(false);
    expect((await row("invoices", id(11))).document_snapshot).toBeNull(); expect((await row("quotes", id(30))).document_snapshot).toBeNull();
    const convertedId = (await convert())!;
    expect((await row("invoices", convertedId)).document_snapshot).toBeNull();
    expect((await getPublicInvoiceById(convertedId))?.items[0].description).toBe("Service B");
  });

  it("retains a replaced logo referenced by a snapshot while still deleting unreferenced logos", async () => {
    const logo = "https://example.test/synthetic-original.png";
    state.logoUrl = logo; await pool.query("UPDATE businesses SET logo_url=$1 WHERE id=$2", [logo,id(3)]);
    expect((await updateInvoiceStatus(id(10), "sent")).error).toBe(false);
    const data = new FormData(); data.set("name", "Changed business"); data.set("logoAction", "remove");
    await expect(updateBusinessProfile(data)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(del).not.toHaveBeenCalled(); expect((await getPublicInvoiceById(id(10)))?.business.logo_url).toBe(logo);
    state.logoUrl = "https://example.test/unreferenced.png";
    await pool.query("UPDATE businesses SET logo_url=$1 WHERE id=$2", [state.logoUrl,id(3)]);
    await expect(updateBusinessProfile(data)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(del).toHaveBeenCalledWith(state.logoUrl);
  });
});
