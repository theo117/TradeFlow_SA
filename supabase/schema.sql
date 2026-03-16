create extension if not exists "pgcrypto";

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.businesses add column if not exists email text;
alter table public.businesses add column if not exists phone text;
alter table public.businesses add column if not exists address text;
alter table public.businesses add column if not exists logo_url text;
alter table public.businesses add column if not exists payment_instructions text;

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
  status text not null check (status in ('draft', 'sent')),
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
  status text not null check (status in ('draft', 'sent', 'paid', 'overdue')) default 'draft',
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

create index if not exists customers_business_id_idx on public.customers (business_id);
create index if not exists services_business_id_idx on public.services (business_id);
create index if not exists quotes_business_id_idx on public.quotes (business_id);
create index if not exists quotes_customer_id_idx on public.quotes (customer_id);
create index if not exists quote_items_quote_id_idx on public.quote_items (quote_id);
create index if not exists invoices_business_id_idx on public.invoices (business_id);
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);
create index if not exists invoices_due_date_idx on public.invoices (due_date);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

alter table public.businesses enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "business owners manage their business" on public.businesses;
create policy "business owners manage their business"
on public.businesses
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "business owners manage customers" on public.customers;
create policy "business owners manage customers"
on public.customers
for all
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = customers.business_id
      and businesses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = customers.business_id
      and businesses.owner_id = auth.uid()
  )
);

drop policy if exists "business owners manage services" on public.services;
create policy "business owners manage services"
on public.services
for all
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = services.business_id
      and businesses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = services.business_id
      and businesses.owner_id = auth.uid()
  )
);

drop policy if exists "business owners manage quotes" on public.quotes;
create policy "business owners manage quotes"
on public.quotes
for all
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = quotes.business_id
      and businesses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = quotes.business_id
      and businesses.owner_id = auth.uid()
  )
);

drop policy if exists "business owners manage quote items" on public.quote_items;
create policy "business owners manage quote items"
on public.quote_items
for all
using (
  exists (
    select 1
    from public.quotes
    join public.businesses on businesses.id = quotes.business_id
    where quotes.id = quote_items.quote_id
      and businesses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.quotes
    join public.businesses on businesses.id = quotes.business_id
    where quotes.id = quote_items.quote_id
      and businesses.owner_id = auth.uid()
  )
);

drop policy if exists "business owners manage invoices" on public.invoices;
create policy "business owners manage invoices"
on public.invoices
for all
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = invoices.business_id
      and businesses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = invoices.business_id
      and businesses.owner_id = auth.uid()
  )
);

drop policy if exists "business owners manage invoice items" on public.invoice_items;
create policy "business owners manage invoice items"
on public.invoice_items
for all
using (
  exists (
    select 1
    from public.invoices
    join public.businesses on businesses.id = invoices.business_id
    where invoices.id = invoice_items.invoice_id
      and businesses.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.invoices
    join public.businesses on businesses.id = invoices.business_id
    where invoices.id = invoice_items.invoice_id
      and businesses.owner_id = auth.uid()
  )
);

create or replace function public.sync_overdue_invoices(target_business_id uuid default null)
returns void
language plpgsql
as $$
begin
  update public.invoices
  set status = 'overdue'
  where due_date < current_date
    and status <> 'paid'
    and (target_business_id is null or business_id = target_business_id);
end;
$$;
