import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../lib/db/schema";

const state = vi.hoisted(() => ({ db: undefined as unknown as PostgresJsDatabase<typeof schema>, businessId: "" }));
// Only the authenticated identity and Next.js response boundaries are simulated.
// The actual server actions, tenant queries, transactions, and SQL persistence run.
vi.mock("@/lib/auth", () => ({ requirePaidBusiness: async () => ({ id: state.businessId }) }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => {
  throw Object.assign(new Error(url), { digest: `NEXT_REDIRECT;replace;${url};307;` });
} }));
vi.mock("@/lib/whatsapp", () => ({ sendQuoteWhatsappMessage: vi.fn(), sendInvoiceWhatsappMessage: vi.fn() }));
vi.mock("@/lib/public-access", () => ({ revokePublicShareTokens: vi.fn() }));

import { createQuote, updateQuoteStatus } from "../app/dashboard/quotes/actions";
import { convertQuoteToInvoice } from "../app/dashboard/invoices/actions";

const adminUrl = process.env.QUOTE_TEST_ADMIN_URL;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

describe.skipIf(!adminUrl)("quote financial integrity (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  let pool: Pool;
  let sql: ReturnType<typeof postgres>;
  let name: string;
  let canonical: string;

  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h06_test_admin") {
      throw new Error("Use only a disposable localhost PostgreSQL server with database h06_test_admin.");
    }
    admin = new Pool({ connectionString: url.href });
    const version = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    expect(version).toBeGreaterThanOrEqual(170000);
    expect(version).toBeLessThan(180000);
    canonical = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  });

  beforeEach(async () => {
    name = `h06_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(adminUrl!);
    url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.href });
    await pool.query(canonical);
    await pool.query(`
      INSERT INTO users(id,email,password_hash,email_verified_at) VALUES
        ($1,'one@example.test','synthetic',now()),($2,'two@example.test','synthetic',now());`, [id(1), id(2)]);
    await pool.query(`INSERT INTO businesses(id,owner_id,name) VALUES ($1,$2,'One'),($3,$4,'Two')`, [id(3), id(1), id(4), id(2)]);
    await pool.query(`INSERT INTO customers(id,business_id,name) VALUES ($1,$2,'Own customer'),($3,$4,'Other customer')`, [id(5), id(3), id(6), id(4)]);
    await pool.query(`INSERT INTO services(id,business_id,name,price) VALUES ($1,$2,'Own service',100),($3,$4,'Other service',50),($5,$2,'Cents service',0.10)`, [id(7), id(3), id(8), id(4), id(9)]);
    sql = postgres(url.href, { prepare: false, max: 1 });
    state.db = drizzle(sql, { schema });
    state.businessId = id(3);
  });

  afterEach(async () => {
    if (sql) await sql.end();
    if (pool) await pool.end();
    if (name) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  });
  afterAll(async () => { if (admin) await admin.end(); });

  function form(items: unknown[], customerId = id(5)) {
    const data = new FormData();
    data.set("customerId", customerId);
    data.set("status", "draft");
    data.set("items", JSON.stringify(items));
    return data;
  }
  async function runAction(action: () => Promise<unknown>) {
    try { await action(); throw new Error("Expected redirect"); }
    catch (error) {
      expect(String((error as { digest?: string }).digest)).toMatch(/^NEXT_REDIRECT;/);
      return (error as Error).message;
    }
  }
  async function storedQuote() {
    return (await pool.query(`SELECT q.id,q.total::text,i.price::text,i.subtotal::text,i.quantity,
      q.total=(SELECT sum(subtotal) FROM quote_items WHERE quote_id=q.id) AS consistent
      FROM quotes q JOIN quote_items i ON i.quote_id=q.id ORDER BY i.price`)).rows;
  }
  async function expectNoFinancialRows() {
    for (const table of ["quotes", "quote_items", "invoices", "invoice_items"])
      expect((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count).toBe(0);
  }

  it.each([
    ["normal minimal payload", {}],
    ["legacy valid payload", { price: 100, subtotal: 200 }],
    ["tampered R1 subtotal", { price: 100, subtotal: 1 }],
    ["tampered R1 unit price", { price: 1, subtotal: 2 }]
  ])("persists R200 for 2 x R100: %s", async (_label, submitted) => {
    const destination = await runAction(() => createQuote(form([{ service_id: id(7), quantity: 2, ...submitted }])));
    expect(destination).toContain("?success=");
    expect(await storedQuote()).toEqual([{ id: expect.any(String), total: "200.00", price: "100.00", subtotal: "200.00", quantity: 2, consistent: true }]);
  });

  it("rejects the previous fractional-cent discrepancy without creating financial records", async () => {
    const old = await pool.query("SELECT (0.005+0.005)::numeric(12,2)::text AS header, (0.005::numeric(12,2)+0.005::numeric(12,2))::text AS lines");
    expect(old.rows[0]).toEqual({ header: "0.01", lines: "0.02" });
    for (const submitted of [{ price: 0.005, subtotal: 0.005 }, { price: 0.10, subtotal: 0.005 }]) {
      const items = Array.from({ length: 2 }, () => ({ service_id: id(9), quantity: 1, ...submitted }));
      const destination = await runAction(() => createQuote(form(items)));
      expect(decodeURIComponent(destination)).toContain("two decimal places");
      await expectNoFinancialRows();
    }
  });

  it("stores exact cents for multiple valid lines without floating-point drift", async () => {
    expect(await runAction(() => createQuote(form([{ service_id: id(9), quantity: 3 }, { service_id: id(9), quantity: 2 }])))).toContain("?success=");
    const rows = await storedQuote();
    expect(rows.map((r) => r.subtotal).sort()).toEqual(["0.20", "0.30"]);
    expect(rows.every((r) => r.total === "0.50" && r.consistent)).toBe(true);
  });

  it("rejects another tenant's service and customer with no financial writes", async () => {
    expect(await runAction(() => createQuote(form([{ service_id: id(7), quantity: 1 }, { service_id: id(8), quantity: 1 }])))).toContain("?error=");
    await expectNoFinancialRows();
    expect(await runAction(() => createQuote(form([{ service_id: id(7), quantity: 1 }], id(6))))).toContain("?error=");
    await expectNoFinancialRows();
  });

  it("rejects malformed quantities and line/header overflow without partial writes", async () => {
    for (const quantity of [0, -1, 0.5, null, 2147483648]) {
      expect(await runAction(() => createQuote(form([{ service_id: id(7), quantity }])))).toContain("?error=");
      await expectNoFinancialRows();
    }
    await pool.query("UPDATE services SET price=9999999999.99 WHERE id=$1", [id(7)]);
    for (const items of [[{ service_id: id(7), quantity: 2 }], [{ service_id: id(7), quantity: 1 }, { service_id: id(7), quantity: 1 }]]) {
      expect(await runAction(() => createQuote(form(items)))).toContain("?error=");
      await expectNoFinancialRows();
    }
  });

  it("converts persisted agreed amounts after the catalogue price changes", async () => {
    expect(await runAction(() => createQuote(form([{ service_id: id(7), quantity: 2 }])))).toContain("?success=");
    const [quote] = await storedQuote();
    expect(await updateQuoteStatus(quote.id, "accepted")).toMatchObject({ error: false });
    await pool.query("UPDATE services SET price=250 WHERE id=$1", [id(7)]);
    const data = new FormData();
    data.set("quoteId", quote.id);
    data.set("dueDate", "2030-01-01");
    expect(await runAction(() => convertQuoteToInvoice(data))).toContain("?success=");
    const invoice = await pool.query(`SELECT v.total::text,i.price::text,i.subtotal::text,i.quantity,
      v.total=(SELECT sum(subtotal) FROM invoice_items WHERE invoice_id=v.id) AS consistent
      FROM invoices v JOIN invoice_items i ON i.invoice_id=v.id`);
    expect(invoice.rows).toEqual([{ total: "200.00", price: "100.00", subtotal: "200.00", quantity: 2, consistent: true }]);
    expect(await storedQuote()).toEqual([quote]);
    expect((await pool.query("SELECT price::text FROM services WHERE id=$1", [id(7)])).rows[0].price).toBe("250.00");
  });
});
