import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requirePaidBusiness } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";
import { customers, invoices } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const business = await requirePaidBusiness();
  const { id } = await context.params;

  const [customer] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(and(eq(customers.businessId, business.id), eq(customers.id, id)))
    .limit(1);

  if (!customer) {
    notFound();
  }

  const rows = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      total: invoices.total,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, business.id), eq(invoices.customerId, id)))
    .orderBy(desc(invoices.createdAt));

  return csvResponse(`tradeflow-statement-${customer.name}.csv`, [
    ["Customer", customer.name],
    ["Business", business.name],
    [],
    ["Invoice number", "Status", "Total", "Due date", "Created"],
    ...rows.map((invoice) => [
      invoice.invoiceNumber,
      invoice.status,
      invoice.total,
      invoice.dueDate,
      invoice.createdAt
    ])
  ]);
}
