alter table public.businesses
alter column trial_ends_at set default now() + interval '3 days';

update public.businesses
set trial_ends_at = created_at + interval '3 days'
where subscription_status = 'trialing'
  and (
    trial_ends_at is null
    or trial_ends_at > created_at + interval '3 days'
  );
