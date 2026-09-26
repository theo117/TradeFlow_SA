import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { MigrationMeta } from "drizzle-orm/migrator";

// Frozen initial migration and PostgreSQL 17 canonical schema, not the latest journal entry.
export const INITIAL_MIGRATION_TIME = 1787410147964;
export const INITIAL_MIGRATION_HASH = "0255db2b99d6a79f80f262b10a7e09ee13c014a978ac6e38faf38f94262682c5";
export const CANONICAL_SCHEMA_HASH = "7ee3242543eea29c6ceae7480e9c6419583aed5451e98fdafa31060cfa397e7a";

// Excludes rows, sequence position, OIDs, owners and grants. Includes public schema
// structure, defaults and integrity rules. Never executes the canonical SQL on a live DB.
export async function schemaFingerprint(client: PoolClient) {
  const { rows } = await client.query(`
    SELECT jsonb_build_object(
      'relations', (SELECT jsonb_agg(jsonb_build_array(c.relname, c.relkind,
        c.relpersistence, c.relrowsecurity, c.relforcerowsecurity, c.reloptions)
        ORDER BY c.relname COLLATE "C") FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')),
      'columns', (SELECT jsonb_agg(jsonb_build_array(c.relname, a.attname,
        format_type(a.atttypid,a.atttypmod), a.attnotnull,
        pg_get_expr(d.adbin,d.adrelid), a.attidentity, a.attgenerated,
        a.attcollation::regcollation::text) ORDER BY c.relname COLLATE "C",a.attname COLLATE "C")
        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
        WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
        AND a.attnum>0 AND NOT a.attisdropped),
      'enums', (SELECT jsonb_agg(jsonb_build_array(t.typname,e.enumlabel)
        ORDER BY t.typname COLLATE "C",e.enumsortorder) FROM pg_type t
        JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
        WHERE n.nspname='public'),
      'constraints', (SELECT jsonb_agg(jsonb_build_array(c.relname,
        pg_get_constraintdef(k.oid),k.convalidated) ORDER BY c.relname COLLATE "C",pg_get_constraintdef(k.oid) COLLATE "C")
        FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
      'indexes', (SELECT jsonb_agg(jsonb_build_array(pg_get_indexdef(i.indexrelid),
        i.indisvalid,i.indisready) ORDER BY pg_get_indexdef(i.indexrelid) COLLATE "C")
        FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
      'sequences', (SELECT jsonb_agg(jsonb_build_array(c.relname,
        s.seqtypid::regtype::text,s.seqstart,s.seqincrement,s.seqmin,s.seqmax,s.seqcache,s.seqcycle)
        ORDER BY c.relname COLLATE "C") FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
      'triggers', (SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY pg_get_triggerdef(t.oid) COLLATE "C")
        FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),
      'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename COLLATE "C",p.policyname COLLATE "C")
        FROM pg_policies p WHERE p.schemaname='public')
    ) AS structure
  `);
  return createHash("sha256").update(JSON.stringify(rows[0].structure)).digest("hex");
}

export async function readHistory(client: PoolClient) {
  const { rows } = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS history");
  if (!rows[0].history) return [];
  return (await client.query<{ hash: string; created_at: string }>(
    'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id'
  )).rows;
}

export async function validateHistory(client: PoolClient, migrations: MigrationMeta[]) {
  const history = await readHistory(client);
  for (const [index, row] of history.entries()) {
    const migration = migrations[index];
    if (!migration || Number(row.created_at) !== migration.folderMillis || row.hash !== migration.hash) {
      throw new Error("Migration history does not match the checked-in journal/hashes. Stop and investigate; history was not changed.");
    }
  }
  return history;
}

export async function baseline(client: PoolClient, migrations: MigrationMeta[]) {
  const initial = migrations[0];
  if (initial?.folderMillis !== INITIAL_MIGRATION_TIME || initial.hash !== INITIAL_MIGRATION_HASH) {
    throw new Error("Initial migration changed; the canonical baseline must be reviewed before adoption.");
  }
  await client.query("BEGIN");
  try {
    // Freeze table definitions/writes while checking and recording adoption.
    // Identifiers are quoted by PostgreSQL, never interpolated from CLI input.
    const { rows } = await client.query(`SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename) AS tables
      FROM pg_tables WHERE schemaname='public'`);
    if (rows[0].tables) await client.query(`LOCK TABLE ${rows[0].tables} IN SHARE MODE`);
    const actual = await schemaFingerprint(client);
    if (actual !== CANONICAL_SCHEMA_HASH) {
      throw new Error(`Schema does not match the frozen canonical baseline (${actual}). No adoption performed; restore a copy and investigate drift.`);
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
    )`);
    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [initial.hash, initial.folderMillis]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function prepareFreshDatabase(client: PoolClient) {
  const { rows } = await client.query(`SELECT
    EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')
      AND NOT (c.relname='invoice_number_seq' AND c.relkind='S'))
    OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typtype='e') AS initialized`);
  if (rows[0].initialized) {
    throw new Error("Existing public schema has no migration history. Use the explicit --baseline procedure; no tables were changed.");
  }
  // This prerequisite repairs the initial migration without changing its SQL/hash.
  // IF NOT EXISTS preserves sequence position even after an interrupted first run.
  await client.query('CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1000');
}

export async function requireInvoiceSequence(client: PoolClient) {
  const { rows } = await client.query(`SELECT count(*)::int AS count FROM pg_sequence s
    JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='invoice_number_seq'`);
  if (rows[0].count !== 1) throw new Error("Invoice sequence is missing. Refusing to recreate or reset it on an initialized database.");
}
