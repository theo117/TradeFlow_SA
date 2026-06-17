create extension if not exists "pgcrypto";

alter table public.users
add column if not exists email_verified_at timestamptz;

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

create unique index if not exists email_verification_tokens_token_hash_idx
on public.email_verification_tokens (token_hash);

create index if not exists email_verification_tokens_user_id_idx
on public.email_verification_tokens (user_id);

create index if not exists email_verification_tokens_expires_at_idx
on public.email_verification_tokens (expires_at);
