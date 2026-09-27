import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSubmissions } from "@/lib/db/schema";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function createOnce<T>(businessId: string, operation: "customer" | "service" | "quote" | "recurring", key: unknown, create: (tx: Transaction) => Promise<T>) {
  const submissionKey = z.string().uuid("Reload the form before submitting.").parse(key);
  return db.transaction(async (tx) => {
    // Serializes only this tenant/operation/submission. The receipt survives lost responses.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${businessId}:${operation}:${submissionKey}`}, 0))`);
    const [receipt] = await tx.select({ result: createSubmissions.result }).from(createSubmissions).where(and(
      eq(createSubmissions.businessId, businessId), eq(createSubmissions.operation, operation), eq(createSubmissions.submissionKey, submissionKey)
    ));
    if (receipt) return { result: receipt.result as T, created: false };
    const result = await create(tx);
    await tx.insert(createSubmissions).values({ businessId, operation, submissionKey, result });
    return { result, created: true };
  });
}
