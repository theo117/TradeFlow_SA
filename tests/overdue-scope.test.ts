import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import * as React from "react";
import { Pool } from "pg";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../lib/db/schema";

const state = vi.hoisted(() => ({
  db: undefined as unknown as PostgresJsDatabase<typeof schema>,
  businessId: "",
  userId: null as string | null
}));
// Only authenticated identity and unused WhatsApp integration are simulated.
// Queries, token checks, audit/rate-limit writes, invoice HTML data and PDF run normally.
vi.mock("@/lib/auth", () => ({
  requirePaidBusiness: async () => ({ id: state.businessId }),
  hasBillingAccess: () => true
}));
vi.mock("@/auth", () => ({ auth: async () => state.userId ? { user: { id: state.userId } } : null }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/whatsapp", () => ({
  parseWhatsappDeliveryState: () => null,
  resolveCustomerWhatsappPhone: () => null,
  normalizeWhatsappPhone: (phone: string) => phone
}));

import { syncOverdueInvoices } from "../lib/invoices";
import {
  getCustomerDetail, getDashboardMetrics, getInvoiceById, getInvoiceByQuoteId,
  getInvoices, getPublicInvoiceById
} from "../lib/queries";
import PublicInvoicePage from "../app/invoice/[id]/page";
import { InvoiceDocument } from "../components/dashboard/invoice-document";
import { GET as invoicePdf } from "../app/api/invoices/[id]/pdf/route";

const execute = promisify(execFile);
const adminUrl = process.env.OVERDUE_TEST_ADMIN_URL;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const token = "synthetic-h09-public-token";

describe.skipIf(!adminUrl)("overdue scope (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  let pool: Pool;
  let client: ReturnType<typeof postgres>;
  let fixture: string;
  let name: string;

  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h09_test_admin") {
      throw new Error("Use only a disposable localhost PostgreSQL server with database h09_test_admin.");
    }
    admin = new Pool({ connectionString: url.href });
    const version = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    expect(version).toBeGreaterThanOrEqual(170000);
    expect(version).toBeLessThan(180000);
    fixture = `h09_fixture_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${fixture}"`);
    url.pathname = `/${fixture}`;
    await execute("npm", ["run", "db:migrate"], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href },
      timeout: 30000
    });
  }, 30000);

  beforeEach(async () => {
    name = `h09_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${fixture}"`);
    const url = new URL(adminUrl!);
    url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.href });
    await pool.query("INSERT INTO users(id,email,password_hash) VALUES ($1,'one@example.test','synthetic'),($2,'two@example.test','synthetic')", [id(1), id(2)]);
    await pool.query("INSERT INTO businesses(id,owner_id,name) VALUES ($1,$2,'One'),($3,$4,'Two')", [id(3), id(1), id(4), id(2)]);
    await pool.query("INSERT INTO customers(id,business_id,name) VALUES ($1,$2,'Own customer'),($3,$4,'Other customer')", [id(5), id(3), id(6), id(4)]);
    await pool.query("INSERT INTO quotes(id,business_id,customer_id,status,total) VALUES ($1,$2,$3,'accepted',123.45)", [id(9), id(3), id(5)]);
    for (const [offset, business, customer] of [[10, 3, 5], [20, 4, 6]]) {
      for (const [index, status] of ["sent", "draft", "paid", "overdue", "sent", "sent", "sent"].entries()) {
        const dueOffset = index === 4 ? 0 : index === 5 ? 1 : -1;
        await pool.query(`INSERT INTO invoices(id,business_id,customer_id,status,total,due_date,quote_id)
          VALUES ($1,$2,$3,$4,123.45,current_date + $5::int,$6)`,
        [id(offset + index), id(business), id(customer), status, dueOffset, offset + index === 10 ? id(9) : null]);
        await pool.query("INSERT INTO invoice_items(invoice_id,description,quantity,price,subtotal) VALUES ($1,'Original amount',1,123.45,123.45)", [id(offset + index)]);
      }
    }
    await pool.query(`INSERT INTO public_share_tokens(business_id,invoice_id,document_type,token_hash,expires_at)
      VALUES ($1,$2,'invoice',$3,now() + interval '1 day')`,
    [id(3), id(10), createHash("sha256").update(token).digest("hex")]);
    // Records every UPDATE, including no-op writes to already-overdue rows.
    await pool.query(`CREATE TABLE h09_invoice_updates(invoice_id uuid,old_status text,new_status text);
      CREATE FUNCTION h09_track_invoice_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO h09_invoice_updates VALUES (NEW.id,OLD.status,NEW.status); RETURN NEW; END $$;
      CREATE TRIGGER h09_track_invoice_update AFTER UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION h09_track_invoice_update()`);
    client = postgres(url.href, { prepare: false, max: 1 });
    state.db = drizzle(client, { schema });
    state.businessId = id(3);
    state.userId = null;
  });

  afterEach(async () => {
    if (client) await client.end();
    if (pool) await pool.end();
    if (name) {
      await vi.waitFor(async () => {
        expect((await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1", [name])).rows[0].count).toBe(0);
      }, { timeout: 5000, interval: 20 });
      await admin.query(`DROP DATABASE "${name}"`);
    }
  });
  afterAll(async () => {
    if (fixture) await admin.query(`DROP DATABASE "${fixture}"`);
    if (admin) await admin.end();
  });

  async function records(omitStatus = false) {
    return {
      invoices: (await pool.query(`SELECT ${omitStatus ? "to_jsonb(i) - 'status'" : "to_jsonb(i)"} AS row FROM invoices i ORDER BY id`)).rows,
      items: (await pool.query("SELECT * FROM invoice_items ORDER BY id")).rows,
      quotes: (await pool.query("SELECT * FROM quotes ORDER BY id")).rows
    };
  }
  async function statuses(business = id(3)) {
    return (await pool.query("SELECT status FROM invoices WHERE business_id=$1 ORDER BY id", [business])).rows.map((r) => r.status);
  }
  async function updates() {
    return (await pool.query("SELECT * FROM h09_invoice_updates ORDER BY invoice_id")).rows;
  }
  function findInvoice(node: React.ReactNode): React.ComponentProps<typeof InvoiceDocument>["invoice"] | undefined {
    if (!React.isValidElement(node)) return undefined;
    const props = node.props as { children?: React.ReactNode; invoice?: React.ComponentProps<typeof InvoiceDocument>["invoice"] };
    if (node.type === InvoiceDocument) return props.invoice;
    for (const child of React.Children.toArray(props.children)) {
      const invoice = findInvoice(child);
      if (invoice) return invoice;
    }
  }

  it("public reads display overdue sent invoices without any financial writes, even when repeated", async () => {
    const before = await records();
    for (let n = 0; n < 3; n++) {
      const invoice = await getPublicInvoiceById(id(10));
      expect(invoice).toMatchObject({ id: id(10), business_id: id(3), status: "overdue", total: 123.45 });
      expect(invoice?.items[0]).toMatchObject({ quantity: 1, price: 123.45, subtotal: 123.45 });
    }
    expect(await records()).toEqual(before);
    expect(await updates()).toEqual([]);
    expect((await statuses(id(4)))[0]).toBe("sent");
    await syncOverdueInvoices(id(4));
    expect((await statuses(id(4)))[0]).toBe("overdue");
    expect((await statuses())[0]).toBe("sent");
    expect((await updates()).every((row) => [id(20), id(26)].includes(row.invoice_id))).toBe(true);
  });

  it("runs public invoice retrieval in a PostgreSQL read-only transaction", async () => {
    const original = state.db;
    await original.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION READ ONLY`);
      state.db = tx as unknown as typeof state.db;
      try {
        expect((await getPublicInvoiceById(id(10)))?.status).toBe("overdue");
        expect(await getPublicInvoiceById(id(999))).toBeNull();
      } finally { state.db = original; }
    });
    expect(await updates()).toEqual([]);
  });

  it("preserves draft, paid, already-overdue, due-today and future public display states", async () => {
    const before = await records();
    const expected = ["overdue", "draft", "paid", "overdue", "sent", "sent", "overdue"];
    for (const [n, status] of expected.entries()) expect((await getPublicInvoiceById(id(10 + n)))?.status).toBe(status);
    expect(await records()).toEqual(before);
    expect(await updates()).toEqual([]);
  });

  it("refreshes only the scoped business's past-due sent invoices, without rewriting other statuses", async () => {
    const before = await records(true);
    const otherStatuses = await statuses(id(4));
    await syncOverdueInvoices(id(3));
    expect(await statuses()).toEqual(["overdue", "draft", "paid", "overdue", "sent", "sent", "overdue"]);
    expect(await statuses(id(4))).toEqual(otherStatuses);
    expect(await records(true)).toEqual(before);
    expect(await updates()).toEqual([
      { invoice_id: id(10), old_status: "sent", new_status: "overdue" },
      { invoice_id: id(16), old_status: "sent", new_status: "overdue" }
    ]);
    await syncOverdueInvoices(id(3));
    expect(await updates()).toHaveLength(2);
  });

  it("rejects absent and empty runtime scope instead of falling back to a table-wide refresh", async () => {
    const before = await records();
    for (const scope of [undefined, null, "", "  "]) {
      await expect(syncOverdueInvoices(scope as string)).rejects.toThrow("business ID is required");
    }
    expect(await records()).toEqual(before);
    expect(await updates()).toEqual([]);
  });

  it.each([
    ["dashboard", () => getDashboardMetrics()],
    ["customer detail", () => getCustomerDetail(id(5))],
    ["invoice by quote", () => getInvoiceByQuoteId(id(9))],
    ["invoice list", () => getInvoices()],
    ["invoice detail", () => getInvoiceById(id(10))]
  ] as const)("keeps the authenticated %s refresh scoped", async (_label, read) => {
    const before = await records(true);
    const otherStatuses = await statuses(id(4));
    expect(await read()).toBeTruthy();
    expect(await statuses()).toEqual(["overdue", "draft", "paid", "overdue", "sent", "sent", "overdue"]);
    expect(await statuses(id(4))).toEqual(otherStatuses);
    expect(await records(true)).toEqual(before);
    expect((await updates()).map((r) => r.invoice_id)).toEqual([id(10), id(16)]);
    expect(await getInvoiceById(id(20))).toBeNull();
    expect(await getCustomerDetail(id(6))).toBeNull();
    expect((await getInvoices()).every((invoice) => invoice.business_id === id(3))).toBe(true);
  });

  it("keeps real public HTML token checks and invoice data intact without financial writes", async () => {
    const before = await records();
    for (let n = 0; n < 2; n++) {
      const page = await PublicInvoicePage({ params: Promise.resolve({ id: id(10) }), searchParams: Promise.resolve({ token }) });
      expect(findInvoice(page)).toMatchObject({ status: "overdue", total: 123.45, items: [expect.objectContaining({ price: 123.45, subtotal: 123.45 })] });
    }
    for (const [invoiceId, accessToken] of [[id(10), "invalid"], [id(20), token], [id(10), undefined]]) {
      await expect(PublicInvoicePage({ params: Promise.resolve({ id: invoiceId! }), searchParams: Promise.resolve({ token: accessToken }) }))
        .rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    }
    expect(await records()).toEqual(before);
    expect(await updates()).toEqual([]);
    // Existing security bookkeeping is retained, not misrepresented as read-only.
    expect((await pool.query("SELECT last_accessed_at IS NOT NULL AS accessed FROM public_share_tokens")).rows[0].accessed).toBe(true);
    expect((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE action='share_token.accessed'")).rows[0].count).toBe(2);
  });

  it("serves real public and owner PDFs, rejects unauthorized access, and never updates invoices", async () => {
    const before = await records();
    async function pdf(invoiceId: string, accessToken?: string) {
      return invoicePdf(new Request(`http://localhost/api/invoices/${invoiceId}/pdf${accessToken ? `?token=${accessToken}` : ""}`), { params: Promise.resolve({ id: invoiceId }) });
    }
    for (let n = 0; n < 2; n++) {
      const response = await pdf(id(10), token);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    }
    expect((await pdf(id(20), token)).status).toBe(404);
    expect((await pdf(id(10))).status).toBe(404);
    state.userId = id(1);
    expect((await pdf(id(10))).status).toBe(200);
    expect((await pdf(id(20))).status).toBe(404);
    expect(await records()).toEqual(before);
    expect(await updates()).toEqual([]);
  });
});
