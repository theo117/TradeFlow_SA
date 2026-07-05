# Production Readiness

TradeFlow SA is safe for a controlled pilot only after these checks pass. Keep `BILLING_ENFORCEMENT=off` until PayFast reconciliation has passed in production-like conditions.

## Release Gates

Every production deploy must pass:

- `npm ci`
- `psql "$DATABASE_URL_UNPOOLED" -f supabase/schema.sql` on a disposable database
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=high`

The GitHub Actions workflow in `.github/workflows/production-gates.yml` runs these gates for pushes and pull requests.

## Required Production Environment

The app now fails fast in production when these are missing:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `PUBLIC_LINK_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `BLOB_READ_WRITE_TOKEN`

Billing variables are only required when `BILLING_ENFORCEMENT=on`. Keep it `off` for now.

## Migrations

For an existing database, apply migrations in order:

```bash
psql "$DATABASE_URL_UNPOOLED" -f supabase/migrations/20260617_email_confirmation.sql
psql "$DATABASE_URL_UNPOOLED" -f supabase/migrations/20260618_password_recovery.sql
psql "$DATABASE_URL_UNPOOLED" -f supabase/migrations/20260618_revoke_unconfirmed_email_access.sql
psql "$DATABASE_URL_UNPOOLED" -f supabase/migrations/20260618_three_day_access_window.sql
psql "$DATABASE_URL_UNPOOLED" -f supabase/migrations/20260705_production_hardening.sql
```

For a new database, apply `supabase/schema.sql` once.

## Monitoring

Configure alerts for:

- Vercel deployment failure
- Vercel function errors above normal baseline
- PayFast `/api/payfast/notify` non-2xx responses
- WhatsApp webhook non-2xx responses
- Resend delivery or bounce failures
- Neon storage, connection, backup, and branch health

Search logs by `requestId`, `businessId`, `quoteId`, `invoiceId`, `paymentId`, `pfPaymentId`, and `message`.

## Backup And Restore

Before launch, rehearse restoring a Neon backup into a separate branch or project. Confirm:

- Authenticated login works
- A quote and invoice can be loaded
- A PDF can be generated
- Audit events and PayFast ITN events are present

Do not test restore by overwriting production.

## Incident Rollback

If production is impaired:

1. Set `BILLING_ENFORCEMENT=off`.
2. Revert to the last known good Vercel deployment.
3. Confirm `/login`, `/dashboard`, quote PDF, invoice PDF, and password reset.
4. Check recent `audit_events` and `payfast_itn_events`.
5. Write an incident note with start time, customer impact, root cause, fix, and follow-up.
