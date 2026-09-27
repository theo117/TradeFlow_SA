import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, customers, invoices, quoteItems, quotes, services } from "@/lib/db/schema";

// Only fields consumed by document HTML/PDF. Operational contact preferences,
// authentication and subscription settings remain live and are never copied.
export type DocumentSnapshot = {
  business: {
    name: string; email: string | null; phone: string | null; address: string | null;
    logoUrl: string | null; vatNumber: string | null; registrationNumber: string | null;
    bankName: string | null; bankAccountName: string | null; bankAccountNumber: string | null;
    bankBranchCode: string | null; paymentInstructions: string | null;
  };
  customer: { name: string; email: string | null; phone: string | null; address: string | null };
};
export type QuoteSnapshot = DocumentSnapshot & {
  items: Record<string, { name: string; description: string | null }>;
};
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function captureDocumentIdentity(tx: Transaction, businessId: string, customerId: string): Promise<DocumentSnapshot> {
  const [identity] = await tx.select({
    business: {
      name: businesses.name, email: businesses.email, phone: businesses.phone, address: businesses.address,
      logoUrl: businesses.logoUrl, vatNumber: businesses.vatNumber, registrationNumber: businesses.registrationNumber,
      bankName: businesses.bankName, bankAccountName: businesses.bankAccountName, bankAccountNumber: businesses.bankAccountNumber,
      bankBranchCode: businesses.bankBranchCode, paymentInstructions: businesses.paymentInstructions
    },
    customer: { name: customers.name, email: customers.email, phone: customers.phone, address: customers.address }
  }).from(businesses).innerJoin(customers, eq(customers.businessId, businesses.id))
    .where(and(eq(businesses.id, businessId), eq(customers.id, customerId))).for("share");
  if (!identity) throw new Error("Document customer does not belong to this business");
  // The share lock also prevents profile/logo replacement from deleting a logo
  // between capture and commit. Settings checks committed snapshot references.
  return identity;
}

// Call only inside the issuance transaction, while holding the document row lock.
// An already-issued legacy document must never acquire a guessed snapshot here.
export async function freezeInvoice(tx: Transaction, businessId: string, invoiceId: string) {
  const [invoice] = await tx.select().from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, invoiceId))).for("update");
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "draft" || invoice.documentSnapshot) return;
  const documentSnapshot = await captureDocumentIdentity(tx, businessId, invoice.customerId);
  await tx.update(invoices).set({ documentSnapshot })
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, invoiceId)));
}

export async function freezeQuote(tx: Transaction, businessId: string, quoteId: string) {
  const [quote] = await tx.select().from(quotes)
    .where(and(eq(quotes.businessId, businessId), eq(quotes.id, quoteId))).for("update");
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "draft" || quote.documentSnapshot) return;
  const identity = await captureDocumentIdentity(tx, businessId, quote.customerId);
  const lines = await tx.select({ id: quoteItems.id, serviceId: quoteItems.serviceId }).from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId));
  const serviceIds = [...new Set(lines.map((line) => line.serviceId))];
  const catalogue = serviceIds.length ? await tx.select({ id: services.id, name: services.name, description: services.description }).from(services)
    .where(and(eq(services.businessId, businessId), inArray(services.id, serviceIds))).for("share") : [];
  if (catalogue.length !== serviceIds.length) throw new Error("Document service does not belong to this business");
  const byId = new Map(catalogue.map((service) => [service.id, service]));
  const items: QuoteSnapshot["items"] = {};
  for (const line of lines) {
    const service = byId.get(line.serviceId)!;
    items[line.id] = { name: service.name, description: service.description };
  }
  await tx.update(quotes).set({ documentSnapshot: { ...identity, items } })
    .where(and(eq(quotes.businessId, businessId), eq(quotes.id, quoteId)));
}

export async function isDocumentLogoReferenced(businessId: string, logoUrl: string) {
  for (const table of [invoices, quotes]) {
    const [reference] = await db.select({ id: table.id }).from(table)
      .where(and(eq(table.businessId, businessId), sql`${table.documentSnapshot}->'business'->>'logoUrl' = ${logoUrl}`)).limit(1);
    if (reference) return true;
  }
  return false;
}
