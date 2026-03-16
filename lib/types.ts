export type Customer = {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
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
  status: "draft" | "sent";
  total: number;
  created_at: string;
  customer?: Pick<Customer, "id" | "name" | "email" | "phone" | "address"> | null;
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
  customer?: Pick<Customer, "id" | "name" | "email" | "phone" | "address"> | null;
  items?: InvoiceItem[];
};

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  payment_instructions: string | null;
  created_at: string;
};
