import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth";
import { syncOverdueInvoices, syncOverdueInvoicesAsAdmin } from "@/lib/invoices";
import { createAdminClient } from "@/lib/supabase/admin";

const invoiceListSelect =
  "id, business_id, customer_id, quote_id, invoice_number, status, total, due_date, created_at, customer:customers(id, name, email, phone, address)";
const invoiceDetailSelect =
  "id, business_id, customer_id, quote_id, invoice_number, status, total, due_date, created_at, business:businesses(id, name, email, phone, address, logo_url, payment_instructions, created_at, owner_id), customer:customers(id, name, email, phone, address, business_id, created_at), items:invoice_items(id, invoice_id, service_id, description, quantity, price, subtotal, service:services(id, name, description))";

export const getDashboardMetrics = cache(async () => {
  const supabase = await createClient();
  const business = await requireBusiness();
  await syncOverdueInvoices(business.id);

  const [
    { count: customerCount },
    { count: quoteCount },
    { count: unpaidInvoiceCount },
    { count: overdueInvoiceCount },
    { data: paidInvoices },
    { data: recentQuotes }
  ] = await Promise.all([
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id),
      supabase
        .from("quotes")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id),
      supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .in("status", ["draft", "sent", "overdue"]),
      supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("status", "overdue"),
      supabase
        .from("invoices")
        .select("total")
        .eq("business_id", business.id)
        .eq("status", "paid"),
      supabase
        .from("quotes")
        .select("id, total, status, created_at, customer:customers(id, name)")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(5)
    ]);

  return {
    customerCount: customerCount ?? 0,
    quoteCount: quoteCount ?? 0,
    unpaidInvoiceCount: unpaidInvoiceCount ?? 0,
    overdueInvoiceCount: overdueInvoiceCount ?? 0,
    totalRevenue:
      paidInvoices?.reduce((sum, invoice) => sum + Number(invoice.total), 0) ?? 0,
    recentQuotes: recentQuotes ?? []
  };
});

export const getCustomers = cache(async () => {
  const supabase = await createClient();
  const business = await requireBusiness();

  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return data ?? [];
});

export const getCustomerById = cache(async (id: string) => {
  const supabase = await createClient();
  const business = await requireBusiness();

  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", business.id)
    .eq("id", id)
    .single();

  return data;
});

export const getServices = cache(async () => {
  const supabase = await createClient();
  const business = await requireBusiness();

  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .order("name");

  return data ?? [];
});

export const getServiceById = cache(async (id: string) => {
  const supabase = await createClient();
  const business = await requireBusiness();

  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .eq("id", id)
    .single();

  return data;
});

export const getQuotes = cache(async () => {
  const supabase = await createClient();
  const business = await requireBusiness();

  const { data } = await supabase
    .from("quotes")
    .select("id, total, status, created_at, customer:customers(id, name, email, phone)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return data ?? [];
});

export const getQuoteById = cache(async (id: string) => {
  const supabase = await createClient();
  const business = await requireBusiness();

  const { data } = await supabase
    .from("quotes")
    .select(
      "id, business_id, customer_id, status, total, created_at, customer:customers(id, name, email, phone, address), items:quote_items(id, service_id, quantity, price, subtotal, service:services(id, name, description))"
    )
    .eq("business_id", business.id)
    .eq("id", id)
    .single();

  return data;
});

export const getInvoiceByQuoteId = cache(async (quoteId: string) => {
  const supabase = await createClient();
  const business = await requireBusiness();
  await syncOverdueInvoices(business.id);

  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, status")
    .eq("business_id", business.id)
    .eq("quote_id", quoteId)
    .maybeSingle();

  return data;
});

export const getInvoices = cache(async () => {
  const supabase = await createClient();
  const business = await requireBusiness();
  await syncOverdueInvoices(business.id);

  const { data } = await supabase
    .from("invoices")
    .select(invoiceListSelect)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return data ?? [];
});

export const getInvoiceById = cache(async (id: string) => {
  const supabase = await createClient();
  const business = await requireBusiness();
  await syncOverdueInvoices(business.id);

  const { data } = await supabase
    .from("invoices")
    .select(invoiceDetailSelect)
    .eq("business_id", business.id)
    .eq("id", id)
    .single();

  return data;
});

export const getPublicInvoiceById = cache(async (id: string) => {
  const supabase = createAdminClient();
  await syncOverdueInvoicesAsAdmin();

  const { data } = await supabase
    .from("invoices")
    .select(invoiceDetailSelect)
    .eq("id", id)
    .single();

  return data;
});
