import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../lib/db/schema";
import { currency } from "../lib/utils";

const state = vi.hoisted(() => ({ db: undefined as unknown as PostgresJsDatabase<typeof schema>, businessId: "" }));
// Simulate authentication and inject the disposable database. Queries, overdue
// refresh, and statement export execute their real implementations.
vi.mock("@/lib/auth", () => ({ requirePaidBusiness: async () => ({ id: state.businessId, name: "Synthetic business" }) }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/whatsapp", () => ({ parseWhatsappDeliveryState: vi.fn() }));
vi.mock("@/lib/public-access", () => ({ getOrCreatePublicShareUrl: vi.fn() }));

import { getCustomerDetail } from "../lib/queries";
import { GET as statement } from "../app/api/customers/[id]/statement/route";

const adminUrl = process.env.CUSTOMER_TEST_ADMIN_URL;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const compactCurrency = (value: string | number) => currency(value).replace(/\s/g, "");

it("formats decimal totals exactly, including cents beyond Number precision, while retaining number formatting", () => {
  expect(compactCurrency("900719925474099.91")).toBe("R900719925474099,91");
  expect(currency("1301.00")).toBe(currency(1301));
  expect(currency("0")).toBe(currency(0));
});

describe.skipIf(!adminUrl)("customer summaries (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  let pool: Pool;
  let client: ReturnType<typeof postgres>;
  let name: string;
  let canonical: string;

  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h08_test_admin") {
      throw new Error("Use only a disposable localhost PostgreSQL server with database h08_test_admin.");
    }
    admin = new Pool({ connectionString: url.href });
    const version = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    expect(version).toBeGreaterThanOrEqual(170000);
    expect(version).toBeLessThan(180000);
    canonical = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  });

  beforeEach(async () => {
    name = `h08_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(adminUrl!);
    url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.href });
    await pool.query(canonical);
    await pool.query("INSERT INTO users(id,email,password_hash) VALUES ($1,'one@example.test','synthetic'),($2,'two@example.test','synthetic')", [id(1), id(2)]);
    await pool.query("INSERT INTO businesses(id,owner_id,name) VALUES ($1,$2,'One'),($3,$4,'Two')", [id(3), id(1), id(4), id(2)]);
    await pool.query("INSERT INTO customers(id,business_id,name) VALUES ($1,$2,'Selected'),($3,$4,'Other tenant'),($5,$2,'Other customer')", [id(5), id(3), id(6), id(4), id(7)]);
    client = postgres(url.href, { prepare: false, max: 1 });
    state.db = drizzle(client, { schema });
    state.businessId = id(3);
  });
  afterEach(async () => {
    if (client) await client.end();
    if (pool) await pool.end();
    if (name) {
      // Pool.end() can resolve before the server observes every socket closing.
      // Wait for disconnection rather than force-terminating closing clients.
      await vi.waitFor(async () => {
        const result = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1", [name]);
        expect(result.rows[0].count).toBe(0);
      }, { timeout: 5000, interval: 20 });
      await admin.query(`DROP DATABASE "${name}"`);
    }
  });
  afterAll(async () => { if (admin) await admin.end(); });

  async function invoice(n: number, status: string, total: string, businessId = id(3), customerId = id(5)) {
    await pool.query(`INSERT INTO invoices(id,business_id,customer_id,status,total,due_date,created_at)
      VALUES ($1,$2,$3,$4,$5,'2099-12-31',TIMESTAMPTZ '2030-01-01' + $6 * INTERVAL '1 day')`,
    [id(100 + n), businessId, customerId, status, total, n]);
  }
  async function fourteenInvoices() {
    const statuses = ["paid", "sent", "overdue", "draft", "paid", "sent", "overdue", "draft", "paid", "sent", "overdue", "draft", "paid", "sent"];
    for (const [n, status] of statuses.entries()) await invoice(n, status, n === 3 ? "1.00" : "100.00");
  }
  async function exportRows(customerId = id(5)) {
    const response = await statement(new Request("http://localhost/test"), { params: Promise.resolve({ id: customerId }) });
    expect(response.status).toBe(200);
    return (await response.text()).trimEnd().split("\n").slice(4).map((line) => line.split(","));
  }

  it("counts and sums all 14 invoices by existing statuses while retaining the latest ten in order", async () => {
    await fourteenInvoices();
    const before = (await pool.query("SELECT * FROM invoices ORDER BY id")).rows;
    const detail = await getCustomerDetail(id(5));
    expect(detail?.invoiceSummary).toEqual({ count: 14, total: "1301.00", paid: "400.00", outstanding: "901.00", overdue: "300.00" });
    expect(detail?.invoices.map((row) => row.id)).toEqual(Array.from({ length: 10 }, (_, n) => id(113 - n)));
    expect(detail?.invoices.reduce((sum, row) => sum + row.total, 0)).toBe(1000);
    expect(compactCurrency(detail!.invoiceSummary.total)).toBe("R1301,00");
    expect((await pool.query("SELECT * FROM invoices ORDER BY id")).rows).toEqual(before);
  });

  it("agrees with all statement rows using the same status definitions", async () => {
    await fourteenInvoices();
    const detail = (await getCustomerDetail(id(5)))!;
    const rows = await exportRows();
    const cents = (value: string) => {
      const [whole, fraction = ""] = value.split(".");
      return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
    };
    const sum = (selected: string[][]) => selected.reduce((total, row) => total + cents(row[2]), BigInt(0));
    expect(rows).toHaveLength(14);
    expect(detail.invoiceSummary.count).toBe(rows.length);
    expect(cents(detail.invoiceSummary.total)).toBe(sum(rows));
    expect(cents(detail.invoiceSummary.paid)).toBe(sum(rows.filter((r) => r[1] === "paid")));
    expect(cents(detail.invoiceSummary.outstanding)).toBe(sum(rows.filter((r) => r[1] !== "paid")));
    expect(cents(detail.invoiceSummary.overdue)).toBe(sum(rows.filter((r) => r[1] === "overdue")));
    expect(detail.invoices.map((r) => r.invoice_number)).toEqual(rows.slice(0, 10).map((r) => r[0]));
  });

  it("isolates both customer and tenant and rejects access to another tenant's customer", async () => {
    await invoice(0, "paid", "10.00");
    await invoice(1, "paid", "200.00", id(3), id(7));
    await invoice(2, "overdue", "300.00", id(4), id(6));
    // The schema permits this inconsistent association; both predicates must protect the read.
    await invoice(3, "sent", "400.00", id(4), id(5));
    const detail = await getCustomerDetail(id(5));
    expect(detail?.invoiceSummary).toEqual({ count: 1, total: "10.00", paid: "10.00", outstanding: "0", overdue: "0" });
    expect(detail?.invoices.map((r) => r.id)).toEqual([id(100)]);
    expect(await exportRows()).toHaveLength(1);
    expect(await getCustomerDetail(id(6))).toBeNull();
    expect((await statement(new Request("http://localhost/test"), { params: Promise.resolve({ id: id(6) }) })).status).toBe(404);
  });

  it("returns a valid zero summary for a customer with no invoices", async () => {
    const detail = await getCustomerDetail(id(5));
    expect(detail?.invoiceSummary).toEqual({ count: 0, total: "0", paid: "0", outstanding: "0", overdue: "0" });
    expect(detail?.invoices).toEqual([]);
    expect(compactCurrency(detail!.invoiceSummary.total)).toBe("R0,00");
    expect(await exportRows()).toEqual([]);
  });

  it("sums decimal cents exactly and supports totals larger than one invoice's numeric precision", async () => {
    await invoice(0, "paid", "0.10");
    await invoice(1, "paid", "0.20");
    await invoice(2, "draft", "9999999999.99");
    await invoice(3, "sent", "9999999999.99");
    expect((await getCustomerDetail(id(5)))?.invoiceSummary).toEqual({ count: 4, total: "20000000000.28", paid: "0.30", outstanding: "19999999999.98", overdue: "0" });
  });
});
