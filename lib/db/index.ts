import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/tradeflow_sa";

const client = postgres(databaseUrl, {
  prepare: false
});

export const db = drizzle(client, { schema });
