import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted"
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue"
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email)
  })
);

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    logoUrl: text("logo_url"),
    vatNumber: text("vat_number"),
    registrationNumber: text("registration_number"),
    bankName: text("bank_name"),
    bankAccountName: text("bank_account_name"),
    bankAccountNumber: text("bank_account_number"),
    bankBranchCode: text("bank_branch_code"),
    paymentInstructions: text("payment_instructions"),
    billingProvider: text("billing_provider"),
    billingCustomerId: text("billing_customer_id"),
    billingSubscriptionId: text("billing_subscription_id"),
    billingPlanId: text("billing_plan_id"),
    subscriptionStatus: text("subscription_status")
      .default("trialing")
      .notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
      mode: "string"
    }),
    trialEndsAt: timestamp("trial_ends_at", {
      withTimezone: true,
      mode: "string"
    }).default(sql`now() + interval '14 days'`),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    ownerIdx: uniqueIndex("businesses_owner_id_idx").on(table.ownerId),
    billingCustomerIdx: uniqueIndex("businesses_billing_customer_id_idx").on(
      table.billingCustomerId
    ),
    billingSubscriptionIdx: uniqueIndex(
      "businesses_billing_subscription_id_idx"
    ).on(table.billingSubscriptionId)
  })
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    businessIdx: index("customers_business_id_idx").on(table.businessId)
  })
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull()
  },
  (table) => ({
    businessIdx: index("services_business_id_idx").on(table.businessId)
  })
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: quoteStatusEnum("status").notNull(),
    total: numeric("total", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    businessIdx: index("quotes_business_id_idx").on(table.businessId),
    customerIdx: index("quotes_customer_id_idx").on(table.customerId)
  })
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull()
  },
  (table) => ({
    quoteIdx: index("quote_items_quote_id_idx").on(table.quoteId)
  })
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references(() => quotes.id, {
      onDelete: "set null"
    }),
    invoiceNumber: text("invoice_number")
      .notNull()
      .unique()
      .default(
        sql`('INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0'))`
      ),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    total: numeric("total", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    businessIdx: index("invoices_business_id_idx").on(table.businessId),
    customerIdx: index("invoices_customer_id_idx").on(table.customerId),
    dueDateIdx: index("invoices_due_date_idx").on(table.dueDate),
    statusIdx: index("invoices_status_idx").on(table.status),
    quoteIdx: uniqueIndex("invoices_quote_id_idx").on(table.quoteId)
  })
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null"
    }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull()
  },
  (table) => ({
    invoiceIdx: index("invoice_items_invoice_id_idx").on(table.invoiceId)
  })
);
