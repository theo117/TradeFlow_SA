create table if not exists public.rate_limits (
  identifier text primary key,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.payfast_itn_events (
  id uuid primary key default gen_random_uuid(),
  payment_id text,
  pf_payment_id text,
  business_id uuid references public.businesses (id) on delete set null,
  plan text,
  payment_status text,
  amount_gross numeric(12, 2),
  signature_hash text,
  validation_status text not null,
  raw_body text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  ignored_reason text
);

create index if not exists rate_limits_blocked_until_idx on public.rate_limits (blocked_until);
create index if not exists rate_limits_updated_at_idx on public.rate_limits (updated_at);
create index if not exists payfast_itn_events_payment_id_idx on public.payfast_itn_events (payment_id);
create index if not exists payfast_itn_events_pf_payment_id_idx on public.payfast_itn_events (pf_payment_id);
create index if not exists payfast_itn_events_business_id_idx on public.payfast_itn_events (business_id);
create index if not exists payfast_itn_events_received_at_idx on public.payfast_itn_events (received_at);
create unique index if not exists payfast_itn_events_unique_processed_status_idx
  on public.payfast_itn_events (pf_payment_id, payment_status)
  where processed_at is not null and pf_payment_id is not null;
