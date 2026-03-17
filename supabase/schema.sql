create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type quote_status as enum ('draft', 'sent');
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue');
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
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
  payment_instructions text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

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

create unique index if not exists users_email_idx on public.users (email);
create unique index if not exists businesses_owner_id_idx on public.businesses (owner_id);
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
