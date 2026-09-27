import { z, ZodError } from "zod";
import { isNextRedirectError } from "@/lib/navigation";
import { logError } from "@/lib/observability";

export const validId = (value: unknown): value is string => z.string().uuid().safeParse(value).success;
export function requireValidId(value: unknown) {
  if (!validId(value)) throw new ZodError([{ code: "custom", path: [], message: "Invalid record identifier" }]);
}
const domainMessages = new Set([
  "An authenticated actor is required to void an invoice",
  "Customer not found",
  "Document customer does not belong to this business",
  "Document service does not belong to this business",
  "Invoice not found",
  "Issued invoices cannot be returned to draft. Void an unpaid invoice instead.",
  "One or more services are invalid.",
  "Only sent or overdue invoices can be voided. Draft invoices can be deleted.",
  "Paid invoices are protected and cannot be voided or deleted",
  "Paid invoices are protected and cannot change status",
  "Quote amount exceeds the supported monetary limit.",
  "Quote amounts must be non-negative with at most two decimal places.",
  "Quote line exceeds the supported monetary limit.",
  "Quote not found",
  "Quote total exceeds the supported monetary limit.",
  "Recurring invoice is paused",
  "Recurring invoice not found",
  "This billing period is no longer available. Refresh recurring invoices.",
  "Use the void action to preserve the invoice audit trail",
  "Void invoices are not payable and cannot be sent for collection",
  "Void invoices cannot change status"
]);

export function safeActionError(error: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (isNextRedirectError(error)) throw error;
  if (error instanceof ZodError) return "Invalid request values. Check the form and try again.";
  if (error instanceof Error && domainMessages.has(error.message) && !error.cause) return error.message;
  logError("Application action failed", error);
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const detail = current as { code?: string; cause?: unknown };
    if (detail.code === "23503") return "This record is in use or a referenced record is unavailable.";
    if (detail.code === "23505") return "This request conflicts with an existing record.";
    current = detail.cause;
  }
  return fallback;
}
