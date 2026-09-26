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

const state = vi.hoisted(() => ({ db: undefined as unknown as PostgresJsDatabase<typeof schema>, businessId: "", userId: "" }));
vi.mock("@/lib/auth", () => ({ requirePaidBusiness: async () => ({ id: state.businessId, owner_id: state.userId }), hasBillingAccess: () => true }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (original) => ({ ...await original<typeof import("next/navigation")>(), useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/whatsapp", () => ({
  sendInvoiceWhatsappMessage: vi.fn(), parseWhatsappDeliveryState: () => null,
  resolveCustomerWhatsappPhone: () => "27820000000", normalizeWhatsappPhone: (phone: string) => phone
}));

import { deleteInvoice, voidInvoice, updateInvoiceStatus, recordInvoiceReminder, convertQuoteToInvoice } from "../app/dashboard/invoices/actions";
import { sendInvoiceWhatsappMessage } from "../lib/whatsapp";
import { getInvoiceById, getPublicInvoiceById, getCustomerDetail, getDashboardMetrics, getInvoices } from "../lib/queries";
import PublicInvoicePage from "../app/invoice/[id]/page";
import InvoicesPage from "../app/dashboard/invoices/page";
import { InvoiceDocument } from "../components/dashboard/invoice-document";
import { InvoiceDetailActions } from "../components/dashboard/invoice-detail-actions";
import { InvoicesTable } from "../components/dashboard/invoices-table";
import { GET as invoicePdf } from "../app/api/invoices/[id]/pdf/route";

const execute = promisify(execFile);
const adminUrl = process.env.VOID_TEST_ADMIN_URL;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const token = "synthetic-h10-token";

describe.skipIf(!adminUrl)("invoice void policy (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  let pool: Pool;
  let client: ReturnType<typeof postgres>;
  let fixture: string;
  let name: string;
  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h10_test_admin") throw new Error("Use only disposable localhost PostgreSQL with database h10_test_admin.");
    admin = new Pool({ connectionString: url.href });
    const version = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    expect(version).toBeGreaterThanOrEqual(170000);
    expect(version).toBeLessThan(180000);
    fixture = `h10_fixture_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${fixture}"`);
    url.pathname = `/${fixture}`;
    await execute("npm", ["run", "db:migrate"], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href }, timeout: 30000
    });
  }, 30000);
  beforeEach(async () => {
    name = `h10_test_${randomUUID().replaceAll("-", "")}`;
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
    client = postgres(url.href, { prepare: false, max: 4, connection: { application_name: "h10_mutations" } });
    state.db = drizzle(client, { schema }); state.businessId = id(3); state.userId = id(1);
    vi.mocked(sendInvoiceWhatsappMessage).mockClear();
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

  async function document(invoiceId: string) {
    return { header: (await pool.query("SELECT to_jsonb(i) AS row FROM invoices i WHERE id=$1", [invoiceId])).rows[0]?.row,
      items: (await pool.query("SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY id", [invoiceId])).rows };
  }
  async function audit() { return (await pool.query("SELECT * FROM audit_events WHERE action='void' ORDER BY created_at")).rows; }

  it("deletes only drafts and cascades their items, while normal draft creation remains available", async () => {
    expect((await deleteInvoice(id(10))).error).toBe(false);
    expect(await document(id(10))).toEqual({ header: undefined, items: [] });
    await pool.query("INSERT INTO quotes(id,business_id,customer_id,status,total) VALUES ($1,$2,$3,'accepted',50)", [id(30), id(3), id(5)]);
    await pool.query("INSERT INTO services(id,business_id,name,price) VALUES ($1,$2,'Synthetic service',50)", [id(31), id(3)]);
    await pool.query("INSERT INTO quote_items(quote_id,service_id,quantity,price,subtotal) VALUES ($1,$2,1,50,50)", [id(30), id(31)]);
    const data = new FormData(); data.set("quoteId", id(30)); data.set("dueDate", "2099-01-22");
    await expect(convertQuoteToInvoice(data)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    const created = (await pool.query("SELECT id,status,total::text FROM invoices WHERE quote_id=$1", [id(30)])).rows[0];
    expect(created).toMatchObject({ status: "draft", total: "50.00" });
    expect((await deleteInvoice(created.id)).error).toBe(false);
    expect((await document(created.id)).items).toEqual([]);
  });

  it.each([[11, "sent"], [12, "overdue"]] as const)("voids %s (%s) with a durable atomic audit and preserves the entire document", async (number, previousStatus) => {
    const before = await document(id(number));
    const sequence = (await pool.query("SELECT last_value::text,is_called FROM invoice_number_seq")).rows;
    expect((await voidInvoice(id(number))).error).toBe(false);
    expect(await document(id(number))).toEqual({ ...before, header: { ...before.header, status: "void" } });
    const entries = await audit(); expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ business_id: id(3), user_id: id(1), action: "void", entity_type: "invoice", entity_id: id(number), created_at: expect.any(Date), metadata: {
      invoiceId: id(number), invoiceNumber: before.header.invoice_number, actorUserId: id(1), businessId: id(3), customerId: id(5), previousStatus, resultingStatus: "void", total: "123.45", dueDate: "2099-01-22"
    } });
    expect((await pool.query("SELECT last_value::text,is_called FROM invoice_number_seq")).rows).toEqual(sequence);
    expect((await pool.query("SELECT next_invoice_date::text FROM recurring_invoice_templates")).rows[0].next_invoice_date).toBe("2099-02-15");
  });

  it.each([11, 12, 13])("rejects hard-deletion of non-draft invoice %s", async (number) => {
    const before = await document(id(number));
    expect((await deleteInvoice(id(number))).error).toBe(true);
    expect(await document(id(number))).toEqual(before);
  });

  it("protects paid and draft invoices against voiding, and prevents downgrade/deletion bypasses", async () => {
    for (const number of [10, 13]) { const before = await document(id(number)); expect((await voidInvoice(id(number))).error).toBe(true); expect(await document(id(number))).toEqual(before); }
    for (const number of [11, 12, 13]) expect((await updateInvoiceStatus(id(number), "draft")).error).toBe(true);
    expect((await updateInvoiceStatus(id(13), "sent")).error).toBe(true);
    expect((await updateInvoiceStatus(id(11), "void" as "sent")).error).toBe(true);
    expect(await audit()).toEqual([]);
    expect((await updateInvoiceStatus(id(10), "sent")).error).toBe(false);
    expect((await updateInvoiceStatus(id(10), "paid")).error).toBe(false);
    expect((await voidInvoice(id(10))).error).toBe(true);
  });

  it("serializes simultaneous voids and safely repeats without duplicate audit or financial effects", async () => {
    const blocker = await pool.connect(); await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM invoices WHERE id=$1 FOR UPDATE", [id(11)]);
    const calls = Promise.all([voidInvoice(id(11)), voidInvoice(id(11))]);
    try {
      await vi.waitFor(async () => expect((await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1 AND application_name='h10_mutations' AND wait_event_type='Lock'", [name])).rows[0].count).toBe(2), { timeout: 5000, interval: 20 });
    } finally { await blocker.query("COMMIT"); blocker.release(); }
    expect((await calls).every((result) => !result.error)).toBe(true);
    expect(await voidInvoice(id(11))).toMatchObject({ error: false, message: "Invoice already void" });
    expect(await audit()).toHaveLength(1);
    expect((await pool.query("SELECT count(*)::int AS count FROM activity_events WHERE type='invoice.voided'")).rows[0].count).toBe(1);
    expect((await deleteInvoice(id(11))).error).toBe(true);
    for (const status of ["draft", "sent", "paid", "overdue"] as const) expect((await updateInvoiceStatus(id(11), status)).error).toBe(true);
  });

  it("serializes payment-status and void requests so a paid or void result cannot be overwritten", async () => {
    const results = await Promise.all([voidInvoice(id(11)), updateInvoiceStatus(id(11), "paid")]);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    const status = (await document(id(11))).header.status;
    expect(["paid", "void"]).toContain(status);
    expect(await audit()).toHaveLength(status === "void" ? 1 : 0);
    expect((await deleteInvoice(id(11))).error).toBe(true);
  });

  it.each(["audit_events", "invoices"])("rolls back both invoice state and audit when %s persistence fails", async (table) => {
    const before = await document(id(11));
    await pool.query(`CREATE FUNCTION h10_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic H10 failure'; END $$;
      CREATE TRIGGER h10_fail AFTER ${table === "invoices" ? "UPDATE" : "INSERT"} ON ${table} FOR EACH ROW EXECUTE FUNCTION h10_fail()`);
    expect((await voidInvoice(id(11))).error).toBe(true);
    expect(await document(id(11))).toEqual(before); expect(await audit()).toEqual([]);
    await pool.query(`DROP TRIGGER h10_fail ON ${table}; DROP FUNCTION h10_fail()`);
    expect((await voidInvoice(id(11))).error).toBe(false); expect(await audit()).toHaveLength(1);
  });

  it("rejects foreign delete/void and fails closed if actor identity is missing", async () => {
    const before = await document(id(20));
    const foreignDraft = await document(id(21));
    expect((await deleteInvoice(id(21))).error).toBe(true); expect((await voidInvoice(id(20))).error).toBe(true);
    expect(await document(id(21))).toEqual(foreignDraft);
    expect(await document(id(20))).toEqual(before);
    state.userId = ""; expect((await voidInvoice(id(11))).error).toBe(true); expect(await audit()).toEqual([]);
  });

  it("makes void invoices non-collectible in summaries, controls, and reminder actions", async () => {
    expect((await voidInvoice(id(11))).error).toBe(false);
    const customer = await getCustomerDetail(id(5));
    expect(customer?.invoiceSummary).toMatchObject({ count: 4, total: "493.80", paid: "123.45", outstanding: "246.90", overdue: "123.45" });
    expect(await getDashboardMetrics()).toMatchObject({ unpaidInvoiceCount: 2, outstandingInvoiceValue: 246.9 });
    const html = renderToStaticMarkup(await InvoicesPage());
    expect(html).toContain("Outstanding value");
    for (const channel of ["email", "whatsapp"] as const) expect((await recordInvoiceReminder(id(11), channel)).error).toBe(true);
    expect(sendInvoiceWhatsappMessage).not.toHaveBeenCalled();
    const actions = renderToStaticMarkup(React.createElement(InvoiceDetailActions, { invoiceId: id(11), status: "void", pdfHref: "/pdf", emailHref: "mailto:synthetic@example.test", whatsappHref: "https://wa.me/27820000000" }));
    for (const absent of ["Mark paid", "Send Reminder", "Resend Email", "Delete invoice", "Void invoice", "mailto:", "wa.me"]) expect(actions).not.toContain(absent);
    expect(actions).toContain("Download PDF");
    const rows = await getInvoices();
    const table = renderToStaticMarkup(React.createElement(InvoicesTable, { invoices: rows.filter((row) => row.status === "void") }));
    expect(table).toContain("not payable"); expect(table).not.toContain("Mark paid"); expect(table).not.toContain("<button title=\"Delete");
  });

  it("preserves authenticated public access and clearly renders void HTML/PDF without payment instructions", async () => {
    await voidInvoice(id(11));
    const before = await document(id(11));
    const page = await PublicInvoicePage({ params: Promise.resolve({ id: id(11) }), searchParams: Promise.resolve({ token }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Void — this invoice is not payable");
    expect(html).toContain("Original invoice total");
    for (const absent of ["Synthetic payment instruction", "synthetic-bank", "wa.me", "Please pay by the due date"]) expect(html).not.toContain(absent);
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const response = await invoicePdf(new Request(`http://localhost/api/invoices/${id(11)}/pdf?token=${token}`), { params: Promise.resolve({ id: id(11) }) });
    expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    const texts = draw.mock.calls.map(([text]) => text).join("\n");
    expect(texts).toContain("VOID - NOT PAYABLE"); expect(texts).toContain("Original total (void)");
    for (const absent of ["Payment instructions", "Banking details", "Total due", "Synthetic payment instruction"]) expect(texts).not.toContain(absent);
    expect(await document(id(11))).toEqual(before);
    await expect(PublicInvoicePage({ params: Promise.resolve({ id: id(11) }), searchParams: Promise.resolve({ token: "wrong" }) })).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it.each([[10, "draft"], [11, "sent"], [12, "overdue"], [13, "paid"]] as const)("preserves normal document display for %s (%s)", async (number, status) => {
    const invoice = (await getPublicInvoiceById(id(number)))!;
    const html = renderToStaticMarkup(React.createElement(InvoiceDocument, { invoice, business: invoice.business!, customer: invoice.customer! }));
    expect(invoice.status).toBe(status); expect(html).toContain("Payment instructions"); expect(html).toContain("Amount due"); expect(html).not.toContain("Void —");
    expect((await getInvoiceById(id(number)))?.status).toBe(status);
    const controls = renderToStaticMarkup(React.createElement(InvoiceDetailActions, { invoiceId: id(number), status, pdfHref: "/pdf" }));
    expect(controls.includes("Delete invoice")).toBe(status === "draft");
    expect(controls.includes("Void invoice")).toBe(status === "sent" || status === "overdue");
    expect(controls.includes("Mark paid")).toBe(status !== "paid");
  });
});
