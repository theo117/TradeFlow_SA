import { eq } from "drizzle-orm";
import { requirePaidBusiness } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";

export async function GET() {
  const business = await requirePaidBusiness();
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.businessId, business.id))
    .orderBy(customers.name);

  return csvResponse("tradeflow-customers.csv", [
    [
      "Name",
      "Email",
      "Phone",
      "WhatsApp",
      "WhatsApp opt-in",
      "Address",
      "Created"
    ],
    ...rows.map((customer) => [
      customer.name,
      customer.email,
      customer.phone,
      customer.whatsappPhone,
      customer.whatsappOptIn,
      customer.address,
      customer.createdAt
    ])
  ]);
}
