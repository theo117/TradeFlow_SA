import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../lib/db/schema";

const state = vi.hoisted(() => ({ db: undefined as unknown as PostgresJsDatabase<typeof schema>, businessId: "" }));
// Only authentication and cache revalidation are simulated. Real server action,
// transactions, row locks, constraints, invoice items, and activity writes execute.
vi.mock("@/lib/auth", () => ({ requirePaidBusiness: async () => ({ id: state.businessId }) }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createInvoiceFromRecurringTemplate as generate } from "../app/dashboard/recurring/actions";

const execute = promisify(execFile);
const adminUrl = process.env.RECURRING_TEST_ADMIN_URL;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const period = "2030-01-15";

describe.skipIf(!adminUrl)("recurring generation (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  let pool: Pool;
  let client: ReturnType<typeof postgres>;
  let fixture: string;
  let name: string;

  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h07_test_admin") {
      throw new Error("Use only a disposable localhost PostgreSQL server with database h07_test_admin.");
    }
    admin = new Pool({ connectionString: url.href });
    const version = Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    expect(version).toBeGreaterThanOrEqual(170000);
    expect(version).toBeLessThan(180000);
    fixture = `h07_fixture_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${fixture}"`);
    url.pathname = `/${fixture}`;
    const output = await execute("npm", ["run", "db:migrate"], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href },
      timeout: 30000
    });
    expect(output.stdout).toContain("Migrations complete:");
  }, 30000);

  beforeEach(async () => {
    name = `h07_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${fixture}"`);
    const url = new URL(adminUrl!);
    url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.href });
    await pool.query("INSERT INTO users(id,email,password_hash) VALUES ($1,'one@example.test','synthetic'),($2,'two@example.test','synthetic')", [id(1), id(2)]);
    await pool.query("INSERT INTO businesses(id,owner_id,name) VALUES ($1,$2,'One'),($3,$4,'Two')", [id(3), id(1), id(4), id(2)]);
    await pool.query("INSERT INTO customers(id,business_id,name) VALUES ($1,$2,'Own customer'),($3,$4,'Other customer')", [id(5), id(3), id(6), id(4)]);
    await pool.query(`INSERT INTO recurring_invoice_templates(id,business_id,customer_id,name,description,frequency,total,next_invoice_date,payment_terms_days)
      VALUES ($1,$2,$3,'Own template','Agreed recurring amount','monthly',123.45,$4,7),
             ($5,$6,$7,'Other template','Other recurring amount','monthly',999,$4,14)`,
    [id(7), id(3), id(5), period, id(8), id(4), id(6)]);
    // Multiple physical connections are essential: max:1 would hide the race.
    client = postgres(url.href, { prepare: false, max: 4, connection: { application_name: "h07_generation" } });
    state.db = drizzle(client, { schema });
    state.businessId = id(3);
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

  async function invoices() {
    return (await pool.query(`SELECT id,business_id,customer_id,invoice_number,status,total::text,
      due_date::text,recurring_template_id,recurring_period::text FROM invoices ORDER BY recurring_period`)).rows;
  }
  async function nextDate() {
    return (await pool.query("SELECT next_invoice_date::text FROM recurring_invoice_templates WHERE id=$1", [id(7)])).rows[0].next_invoice_date;
  }
  async function counts() {
    return (await pool.query(`SELECT (SELECT count(*)::int FROM invoices) AS invoices,
      (SELECT count(*)::int FROM invoice_items) AS items,
      (SELECT count(*)::int FROM activity_events WHERE type='recurring_invoice.invoice_created') AS activity`)).rows[0];
  }

  it("creates one invoice using unchanged template amounts, items, due date, and advancement", async () => {
    const result = await generate(id(7), period);
    expect(result.error).toBe(false);
    expect(await invoices()).toEqual([{
      id: result.invoiceId, business_id: id(3), customer_id: id(5), invoice_number: "INV-001000",
      status: "draft", total: "123.45", due_date: "2030-01-22", recurring_template_id: id(7), recurring_period: period
    }]);
    expect((await pool.query("SELECT description,quantity,price::text,subtotal::text FROM invoice_items")).rows)
      .toEqual([{ description: "Agreed recurring amount", quantity: 1, price: "123.45", subtotal: "123.45" }]);
    expect(await nextDate()).toBe("2030-02-15");
    expect(await counts()).toEqual({ invoices: 1, items: 1, activity: 1 });
  });

  it("coordinates two genuinely simultaneous transactions for the same period", async () => {
    const blocker = await pool.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM recurring_invoice_templates WHERE id=$1 FOR UPDATE", [id(7)]);
    const pending = Promise.all([generate(id(7), period), generate(id(7), period)]);
    try {
      // Prove both action connections reached the lock before allowing either to commit.
      await vi.waitFor(async () => {
        const waiting = await admin.query(`SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname=$1 AND application_name='h07_generation' AND wait_event_type='Lock'`, [name]);
        expect(waiting.rows[0].count).toBe(2);
      }, { timeout: 5000, interval: 20 });
    } finally {
      await blocker.query("COMMIT");
      blocker.release();
    }
    const results = await pending;
    expect(results.every((r) => !r.error)).toBe(true);
    expect(results[0].invoiceId).toBe(results[1].invoiceId);
    expect(results.filter((r) => r.message.includes("already created"))).toHaveLength(1);
    expect(await counts()).toEqual({ invoices: 1, items: 1, activity: 1 });
    expect(await nextDate()).toBe("2030-02-15");
  });

  it("reuses a completed intent after advancement and pause without consuming another invoice number", async () => {
    const first = await generate(id(7), period);
    const before = await invoices();
    const sequence = (await pool.query("SELECT last_value::text,is_called FROM invoice_number_seq")).rows;
    await pool.query("UPDATE recurring_invoice_templates SET status='paused',total=999 WHERE id=$1", [id(7)]);
    const retry = await generate(id(7), period);
    expect(retry).toMatchObject({ error: false, invoiceId: first.invoiceId });
    expect(await invoices()).toEqual(before);
    expect(await nextDate()).toBe("2030-02-15");
    expect(await counts()).toEqual({ invoices: 1, items: 1, activity: 1 });
    expect((await pool.query("SELECT last_value::text,is_called FROM invoice_number_seq")).rows).toEqual(sequence);
    expect((await generate(id(7), "2030-02-15")).error).toBe(true);
  });

  it("safely retries an uncertain response after the financial transaction committed", async () => {
    vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("Synthetic lost response after commit"); });
    expect((await generate(id(7), period)).error).toBe(true);
    const [committed] = await invoices();
    expect(committed).toBeDefined();
    expect(await generate(id(7), period)).toMatchObject({ error: false, invoiceId: committed.id });
    expect(await counts()).toEqual({ invoices: 1, items: 1, activity: 1 });
    expect(await nextDate()).toBe("2030-02-15");
  });

  it.each(["invoice_items", "recurring_invoice_templates"])("rolls back the claim, items, and advancement when %s fails, then permits retry", async (table) => {
    await pool.query(`CREATE FUNCTION h07_injected_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'H07 synthetic rollback failure'; END $$;
      CREATE TRIGGER h07_injected_failure AFTER ${table === "invoice_items" ? "INSERT" : "UPDATE"}
      ON ${table} FOR EACH ROW EXECUTE FUNCTION h07_injected_failure()`);
    expect((await generate(id(7), period)).error).toBe(true);
    expect(await counts()).toEqual({ invoices: 0, items: 0, activity: 0 });
    expect(await nextDate()).toBe(period);
    await pool.query(`DROP TRIGGER h07_injected_failure ON ${table}; DROP FUNCTION h07_injected_failure()`);
    expect((await generate(id(7), period)).error).toBe(false);
    expect(await counts()).toEqual({ invoices: 1, items: 1, activity: 1 });
    expect(await nextDate()).toBe("2030-02-15");
  });

  it("allows an intentional next period while old replays still return their original invoice", async () => {
    const first = await generate(id(7), period);
    const second = await generate(id(7), "2030-02-15");
    expect(first.error).toBe(false);
    expect(second.error).toBe(false);
    expect(second.invoiceId).not.toBe(first.invoiceId);
    expect((await generate(id(7), period)).invoiceId).toBe(first.invoiceId);
    expect((await generate(id(7), "2030-02-15")).invoiceId).toBe(second.invoiceId);
    expect((await invoices()).map((r) => r.recurring_period)).toEqual([period, "2030-02-15"]);
    expect(await nextDate()).toBe("2030-03-15");
    expect(await counts()).toEqual({ invoices: 2, items: 2, activity: 2 });
  });

  it("rejects foreign templates and does not disclose another business's existing result", async () => {
    expect(await generate(id(8), period)).toMatchObject({ error: true, message: "Recurring invoice not found" });
    expect(await counts()).toEqual({ invoices: 0, items: 0, activity: 0 });
    expect((await generate(id(7), period)).error).toBe(false);
    state.businessId = id(4);
    const result = await generate(id(7), period);
    expect(result).toEqual({ error: true, message: "Recurring invoice not found" });
    expect(await counts()).toEqual({ invoices: 1, items: 1, activity: 1 });
  });

  it("rejects missing, invalid, future and stale unclaimed periods without financial writes", async () => {
    for (const invalid of [undefined, "", "2030-02-30", "2029-12-15", "2030-02-15"]) {
      expect((await generate(id(7), invalid as string)).error).toBe(true);
    }
    expect(await counts()).toEqual({ invoices: 0, items: 0, activity: 0 });
    expect(await nextDate()).toBe(period);
  });

  it.each([
    ["quarterly", "2030-04-15"],
    ["annually", "2031-01-15"]
  ])("preserves the existing %s date-advancement behavior", async (frequency, expected) => {
    await pool.query("UPDATE recurring_invoice_templates SET frequency=$1 WHERE id=$2", [frequency, id(7)]);
    expect((await generate(id(7), period)).error).toBe(false);
    expect(await nextDate()).toBe(expected);
  });

  it("enforces identity uniqueness and completeness without restricting ordinary invoices", async () => {
    expect((await generate(id(7), period)).error).toBe(false);
    await expect(pool.query(`INSERT INTO invoices(business_id,customer_id,total,due_date,recurring_template_id,recurring_period)
      VALUES ($1,$2,123.45,'2030-01-22',$3,$4)`, [id(3), id(5), id(7), period])).rejects.toMatchObject({ code: "23505" });
    await expect(pool.query(`INSERT INTO invoices(business_id,customer_id,total,due_date,recurring_template_id)
      VALUES ($1,$2,123.45,'2030-01-22',$3)`, [id(3), id(5), id(7)])).rejects.toMatchObject({ code: "23514" });
    await pool.query(`INSERT INTO invoices(business_id,customer_id,total,due_date)
      VALUES ($1,$2,1,'2030-01-22'),($1,$2,1,'2030-01-22')`, [id(3), id(5)]);
    expect((await invoices()).filter((r) => r.recurring_template_id === null)).toHaveLength(2);
  });

  it("does not regenerate a deleted invoice or accidentally generate the next period on replay", async () => {
    const first = await generate(id(7), period);
    await pool.query("DELETE FROM invoices WHERE id=$1", [first.invoiceId]);
    expect((await generate(id(7), period)).error).toBe(true);
    expect(await invoices()).toEqual([]);
    expect(await nextDate()).toBe("2030-02-15");
    expect((await generate(id(7), "2030-02-15")).error).toBe(false);
  });
});
