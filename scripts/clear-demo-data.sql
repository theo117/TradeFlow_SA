-- One-time production reset after pilot testing.
-- This permanently removes every account and all related TradeFlow records.

begin;

truncate table
  public.login_rate_limits,
  public.users
restart identity cascade;

alter sequence public.invoice_number_seq restart with 1000;

commit;

-- Every value returned below should be 0.
select
  (select count(*) from public.users) as users,
  (select count(*) from public.businesses) as businesses,
  (select count(*) from public.customers) as customers,
  (select count(*) from public.services) as services,
  (select count(*) from public.quotes) as quotes,
  (select count(*) from public.invoices) as invoices,
  (select count(*) from public.recurring_invoice_templates) as recurring_templates,
  (select count(*) from public.activity_events) as activity_events,
  (select count(*) from public.public_share_tokens) as public_share_tokens,
  (select count(*) from public.audit_events) as audit_events;
