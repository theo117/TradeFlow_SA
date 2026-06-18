update public.users
set email_verified_at = null
where email_verified_at = created_at
  and created_at >= timestamptz '2026-06-17 00:00:00+00';
