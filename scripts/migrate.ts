import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { baseline, prepareFreshDatabase, requireInvoiceSequence, validateHistory } from "./migration-support";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--baseline") || args.length > 1) {
    throw new Error("Usage: npm run db:migrate [-- --baseline]");
  }
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required; no implicit local database fallback.");
  const config = { migrationsFolder: "./drizzle" };
  const migrations = readMigrationFiles(config);
  if (!migrations.length || migrations.some((m, i) => i > 0 && m.folderMillis <= migrations[i - 1].folderMillis)) {
    throw new Error("Migration journal must be nonempty and strictly ordered.");
  }
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      // Session lock uses the same dedicated connection as Drizzle. Use a direct
      // PostgreSQL connection (not a transaction-mode pooler) for this command.
      await client.query("SELECT pg_advisory_lock(741014, 7964)");
      await client.query("SET search_path TO public, pg_catalog");
      const history = await validateHistory(client, migrations);
      if (args.includes("--baseline")) {
        if (history.length) {
          console.log(`Already tracked: ${history.length} verified migration(s). Baseline is a no-op.`);
        } else {
          await baseline(client, migrations);
          console.log("Canonical schema adopted: initial migration hash recorded; application rows and invoice sequence untouched. Run npm run db:migrate next.");
        }
      } else {
        if (!history.length) await prepareFreshDatabase(client);
        await requireInvoiceSequence(client);
        await migrate(drizzle(client), config);
        const applied = await validateHistory(client, migrations);
        if (applied.length !== migrations.length) throw new Error("Migration history incomplete after migration.");
        console.log(`Migrations complete: ${applied.length} verified; ${applied.length - history.length} applied.`);
      }
    } finally {
      // Destroy this dedicated connection, releasing its advisory lock even on SQL failure.
      client.release(true);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
