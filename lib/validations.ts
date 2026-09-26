import { z } from "zod";
import { MAX_QUOTE_QUANTITY, quoteMoneyToCents } from "@/lib/quote-money";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const registerSchema = z.object({
  businessName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(10)
});

export const customerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsappPhone: z.string().optional(),
  whatsappOptIn: z.boolean().default(false),
  address: z.string().optional()
});

export const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.coerce.number().min(0)
});

// Legacy/browser amounts are validated when present, but never used for pricing.
const submittedQuoteMoneySchema = z.number().finite().refine((value) => {
  try {
    quoteMoneyToCents(value);
    return true;
  } catch {
    return false;
  }
}, "Quote amounts must be non-negative, within the supported limit, and have at most two decimal places.");

export const quoteQuantitySchema = z.number().finite().int().min(1).max(MAX_QUOTE_QUANTITY);

export const quoteItemSchema = z.object({
  service_id: z.string().uuid(),
  quantity: quoteQuantitySchema,
  price: submittedQuoteMoneySchema.optional(),
  subtotal: submittedQuoteMoneySchema.optional()
});

export const quoteSchema = z.object({
  customerId: z.string().uuid(),
  status: z.enum(["draft", "sent"]),
  items: z.array(quoteItemSchema).min(1)
});

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue"]);

export const convertQuoteToInvoiceSchema = z.object({
  quoteId: z.string().uuid(),
  dueDate: z.string().date()
});

export const recurringInvoiceTemplateSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().min(2),
  frequency: z.enum(["monthly", "quarterly", "annually"]),
  total: z.coerce.number().min(0.01),
  nextInvoiceDate: z.string().date(),
  paymentTermsDays: z.coerce.number().int().min(0).max(90)
});
