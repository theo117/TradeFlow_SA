export type Customer = {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  whatsapp_opt_in: boolean;
  address: string | null;
  created_at: string;
};

export type Service = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
};

export type QuoteItem = {
  id?: string;
  quote_id?: string;
  service_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  service?: Pick<Service, "id" | "name" | "description"> | null;
};

export type Quote = {
  id: string;
  business_id: string;
  customer_id: string;
  status: "draft" | "sent" | "accepted";
  total: number;
  created_at: string;
  whatsapp_delivery_status?: "queued" | "sent" | "delivered" | "read" | "failed" | null;
  business?: Business | null;
  customer?: Pick<Customer, "id" | "name" | "email" | "phone" | "whatsapp_phone" | "whatsapp_opt_in" | "address"> | null;
  items?: QuoteItem[];
};

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export type InvoiceItem = {
  id?: string;
  invoice_id?: string;
  service_id?: string | null;
  description: string;
  quantity: number;
  price: number;
  subtotal: number;
  service?: Pick<Service, "id" | "name" | "description"> | null;
};

export type Invoice = {
  id: string;
  business_id: string;
  customer_id: string;
  quote_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  total: number;
  due_date: string;
  created_at: string;
  whatsapp_delivery_status?: "queued" | "sent" | "delivered" | "read" | "failed" | null;
  business?: Business | null;
  customer?: Pick<Customer, "id" | "name" | "email" | "phone" | "whatsapp_phone" | "whatsapp_opt_in" | "address"> | null;
  items?: InvoiceItem[];
};

export type RecurringInvoiceTemplate = {
  id: string;
  business_id: string;
  customer_id: string;
  name: string;
  description: string;
  frequency: "monthly" | "quarterly" | "annually";
  status: "active" | "paused";
  total: number;
  next_invoice_date: string;
  payment_terms_days: number;
  created_at: string;
  customer?: Pick<Customer, "id" | "name" | "email" | "phone"> | null;
};

export type ActivityEvent = {
  id: string;
  business_id: string;
  customer_id: string | null;
  quote_id: string | null;
  invoice_id: string | null;
  type: string;
  description: string;
  channel: string | null;
  created_at: string;
};

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  vat_number: string | null;
  registration_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  payment_instructions: string | null;
  billing_provider: string | null;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  billing_plan_id: string | null;
  subscription_status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string;
};
