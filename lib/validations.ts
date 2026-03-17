import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const registerSchema = z.object({
  businessName: z.string().min(2),
  email: z.string().email(),
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

export const quoteItemSchema = z.object({
  service_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
  subtotal: z.number().min(0)
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
