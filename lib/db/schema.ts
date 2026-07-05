import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
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
export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "monthly",
  "quarterly",
  "annually"
]);
export const recurringTemplateStatusEnum = pgEnum("recurring_template_status", [
  "active",
  "paused"
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
      mode: "string"
    }),
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

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string"
    }).notNull(),
    usedAt: timestamp("used_at", {
      withTimezone: true,
      mode: "string"
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("email_verification_tokens_token_hash_idx").on(
      table.tokenHash
    ),
    userIdx: index("email_verification_tokens_user_id_idx").on(table.userId),
    expiresAtIdx: index("email_verification_tokens_expires_at_idx").on(
      table.expiresAt
    )
  })
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string"
    }).notNull(),
    usedAt: timestamp("used_at", {
      withTimezone: true,
      mode: "string"
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("password_reset_tokens_token_hash_idx").on(
      table.tokenHash
    ),
    userIdx: index("password_reset_tokens_user_id_idx").on(table.userId),
    expiresAtIdx: index("password_reset_tokens_expires_at_idx").on(
      table.expiresAt
    )
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
    whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
    whatsappBusinessAccountId: text("whatsapp_business_account_id"),
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
    }).default(sql`now() + interval '3 days'`),
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
    whatsappPhone: text("whatsapp_phone"),
    whatsappOptIn: boolean("whatsapp_opt_in").default(false).notNull(),
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

export const recurringInvoiceTemplates = pgTable(
  "recurring_invoice_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    frequency: recurringFrequencyEnum("frequency").notNull(),
    status: recurringTemplateStatusEnum("status").default("active").notNull(),
    total: numeric("total", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    nextInvoiceDate: date("next_invoice_date", { mode: "string" }).notNull(),
    paymentTermsDays: integer("payment_terms_days").default(7).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    businessIdx: index("recurring_invoice_templates_business_id_idx").on(
      table.businessId
    ),
    customerIdx: index("recurring_invoice_templates_customer_id_idx").on(
      table.customerId
    ),
    nextInvoiceDateIdx: index(
      "recurring_invoice_templates_next_invoice_date_idx"
    ).on(table.nextInvoiceDate),
    statusIdx: index("recurring_invoice_templates_status_idx").on(table.status)
  })
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").references(() => quotes.id, {
      onDelete: "set null"
    }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null"
    }),
    type: text("type").notNull(),
    description: text("description").notNull(),
    channel: text("channel"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    businessIdx: index("activity_events_business_id_idx").on(table.businessId),
    customerIdx: index("activity_events_customer_id_idx").on(table.customerId),
    quoteIdx: index("activity_events_quote_id_idx").on(table.quoteId),
    invoiceIdx: index("activity_events_invoice_id_idx").on(table.invoiceId),
    createdAtIdx: index("activity_events_created_at_idx").on(table.createdAt)
  })
);

export const loginRateLimits = pgTable(
  "login_rate_limits",
  {
    identifier: text("identifier").primaryKey(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull(),
    blockedUntil: timestamp("blocked_until", {
      withTimezone: true,
      mode: "string"
    }),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    blockedUntilIdx: index("login_rate_limits_blocked_until_idx").on(table.blockedUntil)
  })
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    identifier: text("identifier").primaryKey(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull(),
    blockedUntil: timestamp("blocked_until", {
      withTimezone: true,
      mode: "string"
    }),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    blockedUntilIdx: index("rate_limits_blocked_until_idx").on(table.blockedUntil),
    updatedAtIdx: index("rate_limits_updated_at_idx").on(table.updatedAt)
  })
);

export const publicShareTokens = pgTable(
  "public_share_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    documentType: text("document_type").notNull(),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "cascade"
    }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string"
    }).notNull(),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "string"
    }),
    lastAccessedAt: timestamp("last_accessed_at", {
      withTimezone: true,
      mode: "string"
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    businessIdx: index("public_share_tokens_business_id_idx").on(table.businessId),
    quoteIdx: index("public_share_tokens_quote_id_idx").on(table.quoteId),
    invoiceIdx: index("public_share_tokens_invoice_id_idx").on(table.invoiceId),
    expiresAtIdx: index("public_share_tokens_expires_at_idx").on(table.expiresAt)
  })
);

export const payfastItnEvents = pgTable(
  "payfast_itn_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: text("payment_id"),
    pfPaymentId: text("pf_payment_id"),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "set null"
    }),
    plan: text("plan"),
    paymentStatus: text("payment_status"),
    amountGross: numeric("amount_gross", {
      precision: 12,
      scale: 2,
      mode: "number"
    }),
    signatureHash: text("signature_hash"),
    validationStatus: text("validation_status").notNull(),
    rawBody: text("raw_body").notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string"
    }),
    ignoredReason: text("ignored_reason")
  },
  (table) => ({
    paymentIdx: index("payfast_itn_events_payment_id_idx").on(table.paymentId),
    pfPaymentIdx: index("payfast_itn_events_pf_payment_id_idx").on(
      table.pfPaymentId
    ),
    businessIdx: index("payfast_itn_events_business_id_idx").on(
      table.businessId
    ),
    receivedAtIdx: index("payfast_itn_events_received_at_idx").on(
      table.receivedAt
    ),
    processedPaymentStatusIdx: uniqueIndex(
      "payfast_itn_events_unique_processed_status_idx"
    )
      .on(table.pfPaymentId, table.paymentStatus)
      .where(sql`processed_at is not null and pf_payment_id is not null`)
  })
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "cascade"
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    ip: text("ip"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string"
    })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    businessIdx: index("audit_events_business_id_idx").on(table.businessId),
    userIdx: index("audit_events_user_id_idx").on(table.userId),
    createdAtIdx: index("audit_events_created_at_idx").on(table.createdAt)
  })
);
