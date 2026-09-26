import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INITIAL_MIGRATION_HASH, INITIAL_MIGRATION_TIME } from "../scripts/migration-support";
import snapshot from "../drizzle/meta/0000_snapshot.json";

const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const adminUrl = process.env.MIGRATION_TEST_ADMIN_URL;

// Explicitly opt in with a dedicated disposable local PostgreSQL 17 server.
// No DATABASE_URL or real env files are read by this suite.
describe.skipIf(!adminUrl)("production migrations (disposable PostgreSQL 17)", () => {
  let admin: Pool;
  const databases: string[] = [];
  const directories: string[] = [];
  let canonical: string;

  beforeAll(async () => {
    const url = new URL(adminUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/h03_test_admin") {
      throw new Error("Use a disposable localhost server with database h03_test_admin only.");
    }
    admin = new Pool({ connectionString: url.href });
    const version = await admin.query("SHOW server_version_num");
    expect(Number(version.rows[0].server_version_num)).toBeGreaterThanOrEqual(170000);
    expect(Number(version.rows[0].server_version_num)).toBeLessThan(180000);
    canonical = await readFile(path.join(root, "supabase/schema.sql"), "utf8");
  });

  afterAll(async () => {
    for (const name of databases) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    if (admin) await admin.end();
    for (const directory of directories) await rm(directory, { recursive: true, force: true });
  });

  async function database(initialized = false) {
    const name = `h03_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    databases.push(name);
    const url = new URL(adminUrl!);
    url.pathname = `/${name}`;
    if (initialized) await query(url.href, canonical);
    return url.href;
  }

  async function query(url: string, sql: string) {
    const pool = new Pool({ connectionString: url });
    try { return await pool.query(sql); } finally { await pool.end(); }
  }

  async function migrate(url: string, args: string[] = [], cwd = root) {
    try {
      const output = await execute("npm", ["run", "db:migrate", "--", ...args], {
        cwd,
        env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
        timeout: 30000
      });
      return { code: 0, output: output.stdout + output.stderr };
    } catch (error) {
      const result = error as { code: number; stdout: string; stderr: string };
      return { code: result.code, output: result.stdout + result.stderr };
    }
  }

  async function sequence(url: string) {
    return (await query(url, "SELECT last_value::text, is_called FROM public.invoice_number_seq")).rows;
  }

  async function rows(url: string) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(snapshot.tables).sort()) {
      const table = key.slice("public.".length);
      result[table] = (await query(url, `SELECT to_jsonb(t) AS row FROM public."${table}" t ORDER BY to_jsonb(t)::text`)).rows;
    }
    return result;
  }

  async function seed(url: string) {
    await query(url, `
      INSERT INTO users(id,email,password_hash,email_verified_at)
        VALUES ('00000000-0000-0000-0000-000000000001','h03@example.test','synthetic-not-a-login',now());
      INSERT INTO businesses(id,owner_id,name)
        VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','H03 synthetic');
      INSERT INTO customers(id,business_id,name)
        VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','H03 customer');
      INSERT INTO invoices(id,business_id,customer_id,total,due_date)
        VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003',123.45,'2030-01-01');
      INSERT INTO invoice_items(invoice_id,description,quantity,price,subtotal)
        VALUES ('00000000-0000-0000-0000-000000000004','Preserve exactly',1,123.45,123.45);
    `);
  }

  it("migrates empty schema, creates all objects, numbers invoices, and safely reruns", async () => {
    const url = await database();
    expect(await migrate(url)).toMatchObject({ code: 0 });
    const tables = (await query(url, "SELECT 'public.' || tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r) => r.name);
    expect(tables).toEqual(Object.keys(snapshot.tables).sort());
    const enums = (await query(url, "SELECT 'public.' || t.typname AS name FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e' ORDER BY t.typname")).rows.map((r) => r.name);
    expect(enums).toEqual(Object.keys(snapshot.enums).sort());
    expect(await sequence(url)).toEqual([{ last_value: "1000", is_called: false }]);
    await seed(url);
    expect((await query(url, "SELECT invoice_number FROM invoices")).rows).toEqual([{ invoice_number: "INV-001000" }]);
    const before = await rows(url);
    const position = await sequence(url);
    const rerun = await migrate(url);
    expect(rerun.code).toBe(0);
    expect(rerun.output).toContain("0 applied");
    expect(await rows(url)).toEqual(before);
    expect(await sequence(url)).toEqual(position);
    expect((await query(url, "SELECT hash,created_at::text FROM drizzle.__drizzle_migrations")).rows)
      .toEqual([{ hash: INITIAL_MIGRATION_HASH, created_at: String(INITIAL_MIGRATION_TIME) }]);
    expect((await query(url, "SELECT nextval('public.invoice_number_seq')::text AS value")).rows[0].value).toBe("1001");
  }, 30000);

  it.each([true, false])("adopts canonical data without changing rows or sequence (is_called=%s)", async (called) => {
    const url = await database(true);
    await seed(url);
    // Synthetic test fixture only: production runner never calls setval/nextval.
    await query(url, `SELECT setval('public.invoice_number_seq', 54321, ${called})`);
    const before = await rows(url);
    const position = await sequence(url);
    const untracked = await migrate(url);
    expect(untracked.code).not.toBe(0);
    expect(untracked.output).toContain("--baseline");
    expect((await query(url, "SELECT to_regclass('drizzle.__drizzle_migrations') AS history")).rows[0].history).toBeNull();
    if (!called) {
      // The previous migrator could leave an empty ledger after failing on existing enums.
      await query(url, `CREATE SCHEMA drizzle;
        CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);`);
    }
    expect((await migrate(url, ["--baseline"])).code).toBe(0);
    expect((await migrate(url)).code).toBe(0);
    expect((await migrate(url)).output).toContain("0 applied");
    expect((await migrate(url, ["--baseline"])).output).toContain("no-op");
    expect(await rows(url)).toEqual(before);
    expect(await sequence(url)).toEqual(position);
    expect((await query(url, "SELECT hash,created_at::text FROM drizzle.__drizzle_migrations")).rows)
      .toEqual([{ hash: INITIAL_MIGRATION_HASH, created_at: String(INITIAL_MIGRATION_TIME) }]);
    const inserted = await query(url, `INSERT INTO invoices(business_id,customer_id,total,due_date)
      VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',10,'2030-01-02') RETURNING invoice_number`);
    expect(inserted.rows[0].invoice_number).toBe(called ? "INV-054322" : "INV-054321");
  }, 30000);

  it("refuses a mismatched schema without writing baseline history", async () => {
    const url = await database(true);
    await query(url, 'ALTER TABLE invoices ALTER COLUMN invoice_number DROP DEFAULT');
    const position = await sequence(url);
    const result = await migrate(url, ["--baseline"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("does not match");
    expect((await query(url, "SELECT to_regclass('drizzle.__drizzle_migrations') AS history")).rows[0].history).toBeNull();
    expect(await sequence(url)).toEqual(position);
  }, 30000);

  it("refuses tampered migration history", async () => {
    const url = await database(true);
    expect((await migrate(url, ["--baseline"])).code).toBe(0);
    await query(url, "UPDATE drizzle.__drizzle_migrations SET hash='synthetic-tampered-hash'");
    const result = await migrate(url);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("history does not match");
  }, 30000);

  it("serializes concurrent fresh migrators", async () => {
    const url = await database();
    const result = await Promise.all([migrate(url), migrate(url)]);
    expect(result.map((r) => r.code)).toEqual([0, 0]);
    expect((await query(url, "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows[0].count).toBe(1);
    expect(await sequence(url)).toEqual([{ last_value: "1000", is_called: false }]);
  }, 30000);

  it("exits nonzero on SQL failure, rolls back migration DDL, and retries safely", async () => {
    const url = await database();
    const fixture = await mkdtemp(path.join(tmpdir(), "tradeflow-h03-failure-"));
    directories.push(fixture);
    await mkdir(path.join(fixture, "scripts"));
    for (const file of ["package.json", "scripts/migrate.ts", "scripts/migration-support.ts"])
      await cp(path.join(root, file), path.join(fixture, file));
    await cp(path.join(root, "drizzle"), path.join(fixture, "drizzle"), { recursive: true });
    await symlink(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "dir");
    const filename = path.join(fixture, "drizzle/0000_worthless_the_santerians.sql");
    const original = await readFile(filename, "utf8");
    await writeFile(filename, original + '\n--> statement-breakpoint\nSELECT * FROM public.h03_missing_relation;\n--> statement-breakpoint\nCREATE TABLE public.h03_must_not_run(id int);');
    const result = await migrate(url, [], fixture);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("Migration failed");
    expect((await query(url, "SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows).toEqual([]);
    expect((await query(url, "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows[0].count).toBe(0);
    expect(await sequence(url)).toEqual([{ last_value: "1000", is_called: false }]);
    await writeFile(filename, original);
    expect((await migrate(url, [], fixture)).code).toBe(0);
    expect((await migrate(url, [], fixture)).output).toContain("0 applied");
  }, 30000);
});
