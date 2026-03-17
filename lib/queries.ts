import { cache } from "react";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { requirePaidBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activityEvents,
  businesses,
  customers,
  invoiceItems,
  invoices,
  quoteItems,
  quotes,
  services
} from "@/lib/db/schema";
import { syncOverdueInvoices, syncOverdueInvoicesAsAdmin } from "@/lib/invoices";
import { parseWhatsappDeliveryState, type WhatsappDeliveryState } from "@/lib/whatsapp";

function mapBusiness(row: {
  id: string;
  ownerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankBranchCode: string | null;
  paymentInstructions: string | null;
  billingProvider: string | null;
  billingCustomerId: string | null;
  billingSubscriptionId: string | null;
  billingPlanId: string | null;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  createdAt: string;
}) {
  return {
    id: row.id,
    owner_id: row.ownerId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    logo_url: row.logoUrl,
    whatsapp_phone_number_id: row.whatsappPhoneNumberId,
    whatsapp_business_account_id: row.whatsappBusinessAccountId,
    vat_number: row.vatNumber,
    registration_number: row.registrationNumber,
    bank_name: row.bankName,
    bank_account_name: row.bankAccountName,
    bank_account_number: row.bankAccountNumber,
    bank_branch_code: row.bankBranchCode,
    payment_instructions: row.paymentInstructions,
    billing_provider: row.billingProvider,
    billing_customer_id: row.billingCustomerId,
    billing_subscription_id: row.billingSubscriptionId,
    billing_plan_id: row.billingPlanId,
    subscription_status: row.subscriptionStatus,
    current_period_end: row.currentPeriodEnd,
    trial_ends_at: row.trialEndsAt,
    created_at: row.createdAt
  };
}

function mapCustomer(row: {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  whatsappOptIn: boolean;
  address: string | null;
  createdAt: string;
}) {
  return {
    id: row.id,
    business_id: row.businessId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    whatsapp_phone: row.whatsappPhone,
    whatsapp_opt_in: row.whatsappOptIn,
    address: row.address,
    created_at: row.createdAt
  };
}

function mapService(row: {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  price: number;
}) {
  return {
    id: row.id,
    business_id: row.businessId,
    name: row.name,
    description: row.description,
    price: row.price
  };
}

async function getLatestWhatsappDeliveryStatus({
  businessId,
  quoteId,
  invoiceId
}: {
  businessId: string;
  quoteId?: string | null;
  invoiceId?: string | null;
}): Promise<WhatsappDeliveryState | null> {
  const [row] = await db
    .select({
      type: activityEvents.type,
      description: activityEvents.description
    })
    .from(activityEvents)
    .where(
      quoteId
        ? and(
            eq(activityEvents.businessId, businessId),
            eq(activityEvents.quoteId, quoteId),
            inArray(activityEvents.type, [
              "quote.whatsapp_sent",
              "quote.whatsapp_status"
            ])
          )
        : and(
            eq(activityEvents.businessId, businessId),
            eq(activityEvents.invoiceId, invoiceId ?? ""),
            inArray(activityEvents.type, [
              "invoice.whatsapp_sent",
              "invoice.whatsapp_reminder_sent",
              "invoice.whatsapp_status"
            ])
          )
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(1);

  if (!row) {
    return null;
  }

  return parseWhatsappDeliveryState(row.type, row.description);
}

export const getDashboardMetrics = cache(async () => {
  const business = await requirePaidBusiness();
  await syncOverdueInvoices(business.id);

  const [
    [{ customerCount }],
    [{ quoteCount }],
    [{ unpaidInvoiceCount }],
    [{ overdueInvoiceCount }],
    paidInvoices,
    recentQuoteRows
  ] = await Promise.all([
    db
      .select({ customerCount: count() })
      .from(customers)
      .where(eq(customers.businessId, business.id)),
    db
      .select({ quoteCount: count() })
      .from(quotes)
      .where(eq(quotes.businessId, business.id)),
    db
      .select({ unpaidInvoiceCount: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.businessId, business.id),
          inArray(invoices.status, ["draft", "sent", "overdue"])
        )
      ),
    db
      .select({ overdueInvoiceCount: count() })
      .from(invoices)
      .where(
        and(eq(invoices.businessId, business.id), eq(invoices.status, "overdue"))
      ),
    db
      .select({ total: invoices.total })
      .from(invoices)
      .where(and(eq(invoices.businessId, business.id), eq(invoices.status, "paid"))),
    db
      .select({
        id: quotes.id,
        businessId: quotes.businessId,
        customerId: quotes.customerId,
        status: quotes.status,
        total: quotes.total,
        createdAt: quotes.createdAt,
        customer: {
          id: customers.id,
          name: customers.name
        }
      })
      .from(quotes)
      .leftJoin(customers, eq(quotes.customerId, customers.id))
      .where(eq(quotes.businessId, business.id))
      .orderBy(desc(quotes.createdAt))
      .limit(5)
  ]);

  return {
    customerCount,
    quoteCount,
    unpaidInvoiceCount,
    overdueInvoiceCount,
    totalRevenue:
      paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0) ?? 0,
    recentQuotes: recentQuoteRows.map((row) => ({
      id: row.id,
      business_id: row.businessId,
      customer_id: row.customerId,
      status: row.status,
      total: row.total,
      created_at: row.createdAt,
      customer: row.customer?.id
        ? {
            id: row.customer.id,
            name: row.customer.name ?? "Unknown"
          }
        : null
    }))
  };
});

export const getCustomers = cache(async () => {
  const business = await requirePaidBusiness();

  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.businessId, business.id))
    .orderBy(desc(customers.createdAt));

  return rows.map((row) => mapCustomer(row));
});

export const getCustomerById = cache(async (id: string) => {
  const business = await requirePaidBusiness();

  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, business.id), eq(customers.id, id)))
    .limit(1);

  return row ? mapCustomer(row) : null;
});

export const getCustomerActivity = cache(async (id: string) => {
  const business = await requirePaidBusiness();

  const rows = await db
    .select()
    .from(activityEvents)
    .where(
      and(eq(activityEvents.businessId, business.id), eq(activityEvents.customerId, id))
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(25);

  return rows.map((row) => ({
    id: row.id,
    business_id: row.businessId,
    customer_id: row.customerId,
    quote_id: row.quoteId,
    invoice_id: row.invoiceId,
    type: row.type,
    description: row.description,
    channel: row.channel,
    created_at: row.createdAt
  }));
});

export const getCustomerDetail = cache(async (id: string) => {
  const business = await requirePaidBusiness();
  await syncOverdueInvoices(business.id);

  const customer = await getCustomerById(id);

  if (!customer) {
    return null;
  }

  const [quoteRows, invoiceRows, activity] = await Promise.all([
    db
      .select({
        id: quotes.id,
        status: quotes.status,
        total: quotes.total,
        createdAt: quotes.createdAt
      })
      .from(quotes)
      .where(and(eq(quotes.businessId, business.id), eq(quotes.customerId, id)))
      .orderBy(desc(quotes.createdAt))
      .limit(10),
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        total: invoices.total,
        dueDate: invoices.dueDate,
        createdAt: invoices.createdAt
      })
      .from(invoices)
      .where(and(eq(invoices.businessId, business.id), eq(invoices.customerId, id)))
      .orderBy(desc(invoices.createdAt))
      .limit(10),
    getCustomerActivity(id)
  ]);

  return {
    customer,
    quotes: quoteRows.map((row) => ({
      id: row.id,
      status: row.status,
      total: row.total,
      created_at: row.createdAt
    })),
    invoices: invoiceRows.map((row) => ({
      id: row.id,
      invoice_number: row.invoiceNumber,
      status: row.status,
      total: row.total,
      due_date: row.dueDate,
      created_at: row.createdAt
    })),
    activity
  };
});

export const getServices = cache(async () => {
  const business = await requirePaidBusiness();

  const rows = await db
    .select()
    .from(services)
    .where(eq(services.businessId, business.id))
    .orderBy(services.name);

  return rows.map((row) => mapService(row));
});

export const getServiceById = cache(async (id: string) => {
  const business = await requirePaidBusiness();

  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.businessId, business.id), eq(services.id, id)))
    .limit(1);

  return row ? mapService(row) : null;
});

export const getQuotes = cache(async () => {
  const business = await requirePaidBusiness();

  const rows = await db
    .select({
      id: quotes.id,
      businessId: quotes.businessId,
      customerId: quotes.customerId,
      status: quotes.status,
      total: quotes.total,
      createdAt: quotes.createdAt,
      customer: {
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        whatsappPhone: customers.whatsappPhone,
        whatsappOptIn: customers.whatsappOptIn,
        address: customers.address
      }
    })
    .from(quotes)
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .where(eq(quotes.businessId, business.id))
    .orderBy(desc(quotes.createdAt));

  return rows.map((row) => ({
    id: row.id,
    business_id: row.businessId,
    customer_id: row.customerId,
    status: row.status,
    total: row.total,
    created_at: row.createdAt,
    customer: row.customer?.id
      ? {
          id: row.customer.id,
          name: row.customer.name ?? "Unknown",
          email: row.customer.email,
          phone: row.customer.phone,
          whatsapp_phone: row.customer.whatsappPhone,
          whatsapp_opt_in: row.customer.whatsappOptIn,
          address: row.customer.address
        }
      : null
  }));
});

async function getQuoteDetail(whereClause: ReturnType<typeof and> | ReturnType<typeof eq>) {
  const [quoteRow] = await db
    .select({
      id: quotes.id,
      businessId: quotes.businessId,
      customerId: quotes.customerId,
      status: quotes.status,
      total: quotes.total,
      createdAt: quotes.createdAt,
      business: {
        id: businesses.id,
        ownerId: businesses.ownerId,
        name: businesses.name,
        email: businesses.email,
        phone: businesses.phone,
        address: businesses.address,
        logoUrl: businesses.logoUrl,
        whatsappPhoneNumberId: businesses.whatsappPhoneNumberId,
        whatsappBusinessAccountId: businesses.whatsappBusinessAccountId,
        vatNumber: businesses.vatNumber,
        registrationNumber: businesses.registrationNumber,
        bankName: businesses.bankName,
        bankAccountName: businesses.bankAccountName,
        bankAccountNumber: businesses.bankAccountNumber,
        bankBranchCode: businesses.bankBranchCode,
        paymentInstructions: businesses.paymentInstructions,
        billingProvider: businesses.billingProvider,
        billingCustomerId: businesses.billingCustomerId,
        billingSubscriptionId: businesses.billingSubscriptionId,
        billingPlanId: businesses.billingPlanId,
        subscriptionStatus: businesses.subscriptionStatus,
        currentPeriodEnd: businesses.currentPeriodEnd,
        trialEndsAt: businesses.trialEndsAt,
        createdAt: businesses.createdAt
      },
      customer: {
        id: customers.id,
        businessId: customers.businessId,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        whatsappPhone: customers.whatsappPhone,
        whatsappOptIn: customers.whatsappOptIn,
        address: customers.address,
        createdAt: customers.createdAt
      }
    })
    .from(quotes)
    .innerJoin(businesses, eq(quotes.businessId, businesses.id))
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .where(whereClause)
    .limit(1);

  if (!quoteRow) {
    return null;
  }

  const itemRows = await db
    .select({
      id: quoteItems.id,
      quoteId: quoteItems.quoteId,
      serviceId: quoteItems.serviceId,
      quantity: quoteItems.quantity,
      price: quoteItems.price,
      subtotal: quoteItems.subtotal,
      service: {
        id: services.id,
        businessId: services.businessId,
        name: services.name,
        description: services.description,
        price: services.price
      }
    })
    .from(quoteItems)
    .leftJoin(services, eq(quoteItems.serviceId, services.id))
    .where(eq(quoteItems.quoteId, quoteRow.id));

  const whatsappDeliveryStatus = await getLatestWhatsappDeliveryStatus({
    businessId: quoteRow.businessId,
    quoteId: quoteRow.id
  });

  return {
    id: quoteRow.id,
    business_id: quoteRow.businessId,
    customer_id: quoteRow.customerId,
    status: quoteRow.status,
    total: quoteRow.total,
    created_at: quoteRow.createdAt,
    business: mapBusiness(quoteRow.business),
    customer: quoteRow.customer?.id ? mapCustomer(quoteRow.customer) : null,
    whatsapp_delivery_status: whatsappDeliveryStatus,
    items: itemRows.map((item) => ({
      id: item.id,
      quote_id: item.quoteId,
      service_id: item.serviceId,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      service: item.service?.id
        ? {
            id: item.service.id,
            name: item.service.name ?? "Unknown service",
            description: item.service.description
          }
        : null
    }))
  };
}

export const getQuoteById = cache(async (id: string) => {
  const business = await requirePaidBusiness();
  return getQuoteDetail(and(eq(quotes.businessId, business.id), eq(quotes.id, id)));
});

export const getPublicQuoteById = cache(async (id: string) => {
  return getQuoteDetail(eq(quotes.id, id));
});

export const getInvoiceByQuoteId = cache(async (quoteId: string) => {
  const business = await requirePaidBusiness();
  await syncOverdueInvoices(business.id);

  const [row] = await db
    .select({
      id: invoices.id,
      invoice_number: invoices.invoiceNumber,
      status: invoices.status
    })
    .from(invoices)
    .where(
      and(eq(invoices.businessId, business.id), eq(invoices.quoteId, quoteId))
    )
    .limit(1);

  return row ?? null;
});

export const getInvoices = cache(async () => {
  const business = await requirePaidBusiness();
  await syncOverdueInvoices(business.id);

  const rows = await db
    .select({
      id: invoices.id,
      businessId: invoices.businessId,
      customerId: invoices.customerId,
      quoteId: invoices.quoteId,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      total: invoices.total,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      customer: {
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        whatsappPhone: customers.whatsappPhone,
        whatsappOptIn: customers.whatsappOptIn,
        address: customers.address
      }
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.businessId, business.id))
    .orderBy(desc(invoices.createdAt));

  return rows.map((row) => ({
    id: row.id,
    business_id: row.businessId,
    customer_id: row.customerId,
    quote_id: row.quoteId,
    invoice_number: row.invoiceNumber,
    status: row.status,
    total: row.total,
    due_date: row.dueDate,
    created_at: row.createdAt,
    customer: row.customer?.id
      ? {
          id: row.customer.id,
          name: row.customer.name ?? "Unknown",
          email: row.customer.email,
          phone: row.customer.phone,
          whatsapp_phone: row.customer.whatsappPhone,
          whatsapp_opt_in: row.customer.whatsappOptIn,
          address: row.customer.address
        }
      : null
  }));
});

async function getInvoiceDetail(whereClause: ReturnType<typeof and> | ReturnType<typeof eq>) {
  const [invoiceRow] = await db
    .select({
      id: invoices.id,
      businessId: invoices.businessId,
      customerId: invoices.customerId,
      quoteId: invoices.quoteId,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      total: invoices.total,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      business: {
        id: businesses.id,
        ownerId: businesses.ownerId,
        name: businesses.name,
        email: businesses.email,
        phone: businesses.phone,
        address: businesses.address,
        logoUrl: businesses.logoUrl,
        whatsappPhoneNumberId: businesses.whatsappPhoneNumberId,
        whatsappBusinessAccountId: businesses.whatsappBusinessAccountId,
        vatNumber: businesses.vatNumber,
        registrationNumber: businesses.registrationNumber,
        bankName: businesses.bankName,
        bankAccountName: businesses.bankAccountName,
        bankAccountNumber: businesses.bankAccountNumber,
        bankBranchCode: businesses.bankBranchCode,
        paymentInstructions: businesses.paymentInstructions,
        billingProvider: businesses.billingProvider,
        billingCustomerId: businesses.billingCustomerId,
        billingSubscriptionId: businesses.billingSubscriptionId,
        billingPlanId: businesses.billingPlanId,
        subscriptionStatus: businesses.subscriptionStatus,
        currentPeriodEnd: businesses.currentPeriodEnd,
        trialEndsAt: businesses.trialEndsAt,
        createdAt: businesses.createdAt
      },
      customer: {
        id: customers.id,
        businessId: customers.businessId,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        whatsappPhone: customers.whatsappPhone,
        whatsappOptIn: customers.whatsappOptIn,
        address: customers.address,
        createdAt: customers.createdAt
      }
    })
    .from(invoices)
    .innerJoin(businesses, eq(invoices.businessId, businesses.id))
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(whereClause)
    .limit(1);

  if (!invoiceRow) {
    return null;
  }

  const itemRows = await db
    .select({
      id: invoiceItems.id,
      invoiceId: invoiceItems.invoiceId,
      serviceId: invoiceItems.serviceId,
      description: invoiceItems.description,
      quantity: invoiceItems.quantity,
      price: invoiceItems.price,
      subtotal: invoiceItems.subtotal,
      service: {
        id: services.id,
        businessId: services.businessId,
        name: services.name,
        description: services.description,
        price: services.price
      }
    })
    .from(invoiceItems)
    .leftJoin(services, eq(invoiceItems.serviceId, services.id))
    .where(eq(invoiceItems.invoiceId, invoiceRow.id));

  const whatsappDeliveryStatus = await getLatestWhatsappDeliveryStatus({
    businessId: invoiceRow.businessId,
    invoiceId: invoiceRow.id
  });

  return {
    id: invoiceRow.id,
    business_id: invoiceRow.businessId,
    customer_id: invoiceRow.customerId,
    quote_id: invoiceRow.quoteId,
    invoice_number: invoiceRow.invoiceNumber,
    status: invoiceRow.status,
    total: invoiceRow.total,
    due_date: invoiceRow.dueDate,
    created_at: invoiceRow.createdAt,
    business: mapBusiness(invoiceRow.business),
    customer: mapCustomer(invoiceRow.customer),
    whatsapp_delivery_status: whatsappDeliveryStatus,
    items: itemRows.map((item) => ({
      id: item.id,
      invoice_id: item.invoiceId,
      service_id: item.serviceId,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      service: item.service?.id
        ? {
            id: item.service.id,
            name: item.service.name ?? "Unknown service",
            description: item.service.description
          }
        : null
    }))
  };
}

export const getInvoiceById = cache(async (id: string) => {
  const business = await requirePaidBusiness();
  await syncOverdueInvoices(business.id);

  return getInvoiceDetail(and(eq(invoices.businessId, business.id), eq(invoices.id, id)));
});

export const getPublicInvoiceById = cache(async (id: string) => {
  await syncOverdueInvoicesAsAdmin();
  return getInvoiceDetail(eq(invoices.id, id));
});
