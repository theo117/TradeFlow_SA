# Production Readiness

TradeFlow SA is safe for a controlled pilot only after these checks pass. Keep `BILLING_ENFORCEMENT=off` until PayFast reconciliation has passed in production-like conditions.

## Release Gates

Every production deploy must pass:

- `npm ci`
- `npm run db:migrate` on an empty disposable database, plus the PostgreSQL migration tests below
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=high`

The existing GitHub Actions workflow in `.github/workflows/production-gates.yml` still initializes its test database with canonical SQL. Run the migration integration checks below as well; that workflow does not yet exercise the production migration path.

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

Use `npm run db:migrate` for the production path. It prefers `DATABASE_URL_UNPOOLED`, falling back to `DATABASE_URL`; provide a **direct PostgreSQL connection**, not a transaction-mode pooler. Missing connection configuration fails without a localhost fallback. SQL errors exit non-zero, and migration hashes/order are checked against `drizzle/meta/_journal.json` before applying anything.

### Fresh database

```bash
npm run db:migrate
npm run db:migrate  # verifies history; reports 0 applied
```

Do not apply `supabase/schema.sql` first. The runner creates `public.invoice_number_seq START WITH 1000` before the unchanged initial migration references it. This prerequisite uses `IF NOT EXISTS`, never a sequence reset. Drizzle applies pending SQL and its history insert transactionally. On failure, its DDL/history insert rolls back; the prerequisite sequence and empty migration-history table may remain, allowing a safe retry.

### Existing canonical installation: explicit one-time adoption

Do not rerun canonical SQL or the historical `supabase/migrations` scripts as an adoption shortcut: some include data updates. Do not delete existing tables or invent migration-history rows manually.

1. Take a verified backup and restore it to a separate disposable PostgreSQL 17 database first. Rehearse this entire procedure on that copy.
2. Pause application writes and automatic deploy/migration jobs during adoption. Both migration commands serialize with a PostgreSQL advisory lock; baseline also briefly locks existing public tables against writes/DDL while verifying them.
3. Capture existing row counts and `SELECT last_value, is_called FROM public.invoice_number_seq;` without calling `nextval`.
4. Run:

   ```bash
   npm run db:migrate -- --baseline
   npm run db:migrate
   npm run db:migrate  # must report 0 applied
   ```

5. Verify history and compare row/sequence state with the pre-adoption capture:

   ```bash
   psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 -c \
     'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;'
   psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 -c \
     'SELECT last_value, is_called FROM public.invoice_number_seq;'
   ```

   For the current initial migration, `created_at` is `1787410147964` and SHA-256 is `0255db2b99d6a79f80f262b10a7e09ee13c014a978ac6e38faf38f94262682c5`. These values are also frozen in `scripts/migration-support.ts`.
6. Resume application writes only after verification.

Baseline is deliberately conservative. It compares public tables/columns/defaults, enums, constraints, indexes, sequence **definitions**, triggers and policies with a frozen fingerprint of the current canonical schema on PostgreSQL 17. Rows, current sequence position, owners, and grants are not fingerprinted or changed. Extra/partial/older schemas, altered defaults or constraints, and changed migration hashes are rejected for investigation on a restored copy. There is no automatic repair, drop/recreate, or sequence alignment/reset fallback. The canonical schema's existing additional constraints are preserved; adoption does not make structural changes to match Drizzle.

Successful adoption inserts only the initial migration hash/timestamp into the standard `drizzle.__drizzle_migrations` ledger, in a transaction. Later migrations are **not** marked applied by baseline; the normal migration command must execute them. If verified history already exists, baseline is a no-op. Never regenerate the frozen fingerprint merely to bypass a mismatch.

### Eventual VPS commands (operator-run, after backup/rehearsal)

These commands are instructions only; they must not be run automatically during an audit or local verification. Ensure the migration service receives a direct connection through its existing runtime environment configuration.

```bash
# Pause automatic deployment jobs first; then stop application writes.
docker compose -f compose.prod.yml stop tradeflow
docker compose -f compose.prod.yml build migrate

# EXISTING canonical database only (omit for a fresh empty database):
docker compose -f compose.prod.yml run --rm --no-deps migrate npm run db:migrate -- --baseline

# Both fresh and adopted databases:
docker compose -f compose.prod.yml run --rm --no-deps migrate npm run db:migrate
docker compose -f compose.prod.yml run --rm --no-deps migrate npm run db:migrate

# Inspect history and preserved data/sequence using the SQL above before resuming.
docker compose -f compose.prod.yml start tradeflow
```

If any command fails, stop and investigate; do not proceed to the next step or resume writes. No sequence-reset or destructive recovery command is part of this procedure. Provisioning a backup is operator-specific; restore verification is required before adoption.

### Reproducible local migration tests

Use only a dedicated disposable PostgreSQL 17 server. The integration suite refuses a non-local host or an admin database name other than `h03_test_admin`; it creates/drops only its own randomly named test databases. It does not read application env files or use `DATABASE_URL` as its target.

```bash
docker run -d --name tradeflow-migration-tests \
  -e POSTGRES_USER=h03 -e POSTGRES_PASSWORD=h03-disposable \
  -e POSTGRES_DB=h03_test_admin -p 127.0.0.1:55443:5432 \
  --tmpfs /var/lib/postgresql/data postgres:17
# Wait until pg_isready succeeds before running the tests:
docker exec tradeflow-migration-tests pg_isready -U h03 -d h03_test_admin
MIGRATION_TEST_ADMIN_URL=postgres://h03:h03-disposable@127.0.0.1:55443/h03_test_admin npm test
docker rm -f tradeflow-migration-tests
```

Without `MIGRATION_TEST_ADMIN_URL`, these database integration tests are skipped and the ordinary unit tests still run. Canonical SQL is used only to create the disposable existing-installation fixture, with SQL errors propagated. Tests invoke the real `npm run db:migrate` command, preserve synthetic invoices and both `is_called` sequence states, verify no-op reruns, reject schema/history drift, serialize concurrent migrators, and prove transaction rollback/non-zero exit on an injected SQL failure.

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
