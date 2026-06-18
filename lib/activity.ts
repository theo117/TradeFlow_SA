import { db } from "@/lib/db";
import { activityEvents } from "@/lib/db/schema";
import { logError } from "@/lib/observability";

export async function logActivityEvent({
  businessId,
  customerId,
  quoteId,
  invoiceId,
  type,
  description,
  channel
}: {
  businessId: string;
  customerId?: string | null;
  quoteId?: string | null;
  invoiceId?: string | null;
  type: string;
  description: string;
  channel?: string | null;
}) {
  try {
    await db.insert(activityEvents).values({
      businessId,
      customerId: customerId ?? null,
      quoteId: quoteId ?? null,
      invoiceId: invoiceId ?? null,
      type,
      description,
      channel: channel ?? null
    });
  } catch (error) {
    logError("Activity event logging failed", error, {
      type,
      businessId,
      customerId,
      quoteId,
      invoiceId
    });
  }
}
