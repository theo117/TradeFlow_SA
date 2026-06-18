create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type quote_status as enum ('draft', 'sent', 'accepted');
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue');
  end if;

  if not exists (select 1 from pg_type where typname = 'recurring_frequency') then
    create type recurring_frequency as enum ('monthly', 'quarterly', 'annually');
  end if;

  if not exists (select 1 from pg_type where typname = 'recurring_template_status') then
    create type recurring_template_status as enum ('active', 'paused');
  end if;
end
$$;

alter type quote_status add value if not exists 'accepted';

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists email_verified_at timestamptz;

update public.users
set email_verified_at = created_at
where email_verified_at is null;

create table if not exists public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.users (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  logo_url text,
  whatsapp_phone_number_id text,
  whatsapp_business_account_id text,
  vat_number text,
  registration_number text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch_code text,
  payment_instructions text,
  billing_provider text,
  billing_customer_id text unique,
  billing_subscription_id text unique,
  billing_plan_id text,
  subscription_status text not null default 'trialing',
  current_period_end timestamptz,
  trial_ends_at timestamptz default now() + interval '3 days',
  created_at timestamptz not null default now()
);

alter table public.businesses add column if not exists vat_number text;
alter table public.businesses add column if not exists whatsapp_phone_number_id text;
alter table public.businesses add column if not exists whatsapp_business_account_id text;
alter table public.businesses add column if not exists registration_number text;
alter table public.businesses add column if not exists bank_name text;
alter table public.businesses add column if not exists bank_account_name text;
alter table public.businesses add column if not exists bank_account_number text;
alter table public.businesses add column if not exists bank_branch_code text;
alter table public.businesses add column if not exists billing_provider text;
alter table public.businesses add column if not exists billing_customer_id text;
alter table public.businesses add column if not exists billing_subscription_id text;
alter table public.businesses add column if not exists billing_plan_id text;
alter table public.businesses add column if not exists subscription_status text not null default 'trialing';
alter table public.businesses add column if not exists current_period_end timestamptz;
alter table public.businesses add column if not exists trial_ends_at timestamptz default now() + interval '3 days';

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  whatsapp_phone text,
  whatsapp_opt_in boolean not null default false,
  address text,
  created_at timestamptz not null default now()
);

alter table public.customers add column if not exists whatsapp_phone text;
alter table public.customers add column if not exists whatsapp_opt_in boolean not null default false;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  status quote_status not null,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  price numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null default 0
);

create sequence if not exists public.invoice_number_seq start 1000;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  quote_id uuid unique references public.quotes (id) on delete set null,
  invoice_number text not null unique default (
    'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')
  ),
  status invoice_status not null default 'draft',
  total numeric(12, 2) not null default 0,
  due_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  description text not null,
  quantity integer not null check (quantity > 0),
  price numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null default 0
);

create table if not exists public.recurring_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  name text not null,
  description text not null,
  frequency recurring_frequency not null,
  status recurring_template_status not null default 'active',
  total numeric(12, 2) not null default 0,
  next_invoice_date date not null,
  payment_terms_days integer not null default 7,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete set null,
  type text not null,
  description text not null,
  channel text,
  created_at timestamptz not null default now()
);

create table if not exists public.login_rate_limits (
  identifier text primary key,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.public_share_tokens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_by_user_id uuid references public.users (id) on delete set null,
  document_type text not null,
  quote_id uuid references public.quotes (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  ip text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_idx on public.users (email);
create unique index if not exists email_verification_tokens_token_hash_idx on public.email_verification_tokens (token_hash);
create index if not exists email_verification_tokens_user_id_idx on public.email_verification_tokens (user_id);
create index if not exists email_verification_tokens_expires_at_idx on public.email_verification_tokens (expires_at);
create unique index if not exists password_reset_tokens_token_hash_idx on public.password_reset_tokens (token_hash);
create index if not exists password_reset_tokens_user_id_idx on public.password_reset_tokens (user_id);
create index if not exists password_reset_tokens_expires_at_idx on public.password_reset_tokens (expires_at);
create unique index if not exists businesses_owner_id_idx on public.businesses (owner_id);
create unique index if not exists businesses_billing_customer_id_idx on public.businesses (billing_customer_id);
create unique index if not exists businesses_billing_subscription_id_idx on public.businesses (billing_subscription_id);
create index if not exists customers_business_id_idx on public.customers (business_id);
create index if not exists services_business_id_idx on public.services (business_id);
create index if not exists quotes_business_id_idx on public.quotes (business_id);
create index if not exists quotes_customer_id_idx on public.quotes (customer_id);
create index if not exists quote_items_quote_id_idx on public.quote_items (quote_id);
create unique index if not exists invoices_quote_id_idx on public.invoices (quote_id);
create index if not exists invoices_business_id_idx on public.invoices (business_id);
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);
create index if not exists invoices_due_date_idx on public.invoices (due_date);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists recurring_invoice_templates_business_id_idx on public.recurring_invoice_templates (business_id);
create index if not exists recurring_invoice_templates_customer_id_idx on public.recurring_invoice_templates (customer_id);
create index if not exists recurring_invoice_templates_next_invoice_date_idx on public.recurring_invoice_templates (next_invoice_date);
create index if not exists recurring_invoice_templates_status_idx on public.recurring_invoice_templates (status);
create index if not exists activity_events_business_id_idx on public.activity_events (business_id);
create index if not exists activity_events_customer_id_idx on public.activity_events (customer_id);
create index if not exists activity_events_quote_id_idx on public.activity_events (quote_id);
create index if not exists activity_events_invoice_id_idx on public.activity_events (invoice_id);
create index if not exists activity_events_created_at_idx on public.activity_events (created_at);
create index if not exists login_rate_limits_blocked_until_idx on public.login_rate_limits (blocked_until);
create index if not exists public_share_tokens_business_id_idx on public.public_share_tokens (business_id);
create index if not exists public_share_tokens_quote_id_idx on public.public_share_tokens (quote_id);
create index if not exists public_share_tokens_invoice_id_idx on public.public_share_tokens (invoice_id);
create index if not exists public_share_tokens_expires_at_idx on public.public_share_tokens (expires_at);
create index if not exists audit_events_business_id_idx on public.audit_events (business_id);
create index if not exists audit_events_user_id_idx on public.audit_events (user_id);
create index if not exists audit_events_created_at_idx on public.audit_events (created_at);
