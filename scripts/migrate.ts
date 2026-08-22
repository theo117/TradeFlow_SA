import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log("Running migrations...");

  await migrate(db, {
    migrationsFolder: "./drizzle",
  });

  console.log("✅ Migrations completed.");

  await pool.end();
}

main().catch(async (err) => {
  console.error("❌ Migration failed:");
  console.error(err);
  process.exit(1);
});