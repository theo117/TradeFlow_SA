import { desc, eq } from "drizzle-orm";
import { requirePaidBusiness } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";
import { customers, invoices } from "@/lib/db/schema";

export async function GET() {
  const business = await requirePaidBusiness();
  const rows = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      total: invoices.total,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      customerName: customers.name,
      customerEmail: customers.email
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.businessId, business.id))
    .orderBy(desc(invoices.createdAt));

  return csvResponse("tradeflow-invoices.csv", [
    [
      "Invoice number",
      "Customer",
      "Customer email",
      "Status",
      "Total",
      "Due date",
      "Created"
    ],
    ...rows.map((invoice) => [
      invoice.invoiceNumber,
      invoice.customerName,
      invoice.customerEmail,
      invoice.status,
      invoice.total,
      invoice.dueDate,
      invoice.createdAt
    ])
  ]);
}
