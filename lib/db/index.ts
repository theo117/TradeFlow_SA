import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { getDatabaseUrl } from "@/lib/env";

type TradeFlowDatabase = PostgresJsDatabase<typeof schema>;

let client: postgres.Sql | null = null;
let database: TradeFlowDatabase | null = null;

export function getDb() {
  if (!client) {
    client = postgres(getDatabaseUrl(), {
      prepare: false
    });
  }

  if (!database) {
    database = drizzle(client, { schema });
  }

  return database;
}

export const db = new Proxy({} as TradeFlowDatabase, {
  get(_target, property, receiver) {
    const value = Reflect.get(getDb(), property, receiver);
    return typeof value === "function" ? value.bind(getDb()) : value;
  }
});
