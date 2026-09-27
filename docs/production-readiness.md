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

### Recurring generation identity (H07)

Migration `0001_recurring_generation_identity` adds nullable `invoices.recurring_template_id`
and `invoices.recurring_period`, a template foreign key, a unique template/period index,
and a check requiring both identity fields together. It does not backfill or change old
invoice values or reset invoice numbering. `supabase/schema.sql` remains the frozen
initial adoption fixture; it is not the latest schema. Use the migration runner to
apply subsequent migrations after adoption.

Before eventually releasing this change, validate a restored production copy and inspect
past recurring invoice duplicates and each template's next date. Historical invoices lack
reliable period metadata, so this migration deliberately does not infer identities or
repair past duplicates. Follow the existing backup/adoption procedure above, stop old
application instances from generating invoices, run `npm run db:migrate`, then rerun it
to verify zero pending migrations before starting the updated application. Old application
instances do not supply generation identities and must not remain active during rollout.
No production commands were executed as part of H07 validation.

The UI submits the template ID plus the displayed next invoice date. Replays return the
same invoice; a refreshed next date permits deliberate generation of the following period.
Missing/invalid or unavailable dates fail closed. Older open tabs may need refreshing.
If a generated invoice was explicitly deleted through the existing invoice flow, replaying
its old period fails rather than generating another period. Templates linked to generated
invoices cannot be deleted while those references exist. The additive index/constraints
can lock the invoice table during migration; schedule the migration appropriately.

Focused disposable PostgreSQL 17 validation (never use production credentials):

```bash
RECURRING_TEST_ADMIN_URL=postgres://USER:PASSWORD@127.0.0.1:PORT/h07_test_admin \
  npm test -- tests/recurring-generation.test.ts
```

The test server must be disposable. The suite invokes the real migration command, creates
isolated databases, exercises simultaneous calls on separate connections, retries,
rollback, subsequent periods, tenant isolation and database uniqueness, then removes its fixtures.

### Invoice deletion and void policy (H10)

Migration `0002_invoice_void_status` adds `void` to `invoice_status`; it does not
rewrite invoice rows or reset invoice numbering. Apply pending migrations with
`npm run db:migrate` and verify a rerun reports zero applied migrations. Existing
untracked canonical installations must first follow the explicit baseline procedure
above. The frozen initial schema and historical migration SQL remain unchanged.

Before eventual rollout, stop old application instances from mutating invoices,
apply the migration, and start the updated application. Old code permits issued
invoice deletion and does not understand the void policy; do not mix application
versions or roll back to such code after creating void invoices. Validate on a
restored disposable database first. No production commands were run for H10.

Drafts may be deleted. Sent/overdue invoices may be voided; paid and void invoices
cannot be deleted. Paid invoices cannot be voided. Issued invoices cannot be reset
to draft, paid invoices cannot be downgraded, and void is terminal in this UI/API.
Voiding locks the tenant-scoped invoice and inserts an `audit_events` record with
`action = 'void'` in the same transaction as the status change. The record includes
actor ID (also copied into metadata), timestamp, previous/resulting status, invoice
ID/number, tenant/customer/quote/recurring references, exact original total and dates.
No reason is collected. Existing activity logging supplements this durable record.

Public links retain their normal access controls and show void documents as not
payable. HTML/PDF retain original amounts and details but suppress collection
prompts and payment instructions. Outstanding totals exclude void invoices; historical
invoice counts and lifetime totals continue to include retained documents. No refund,
credit-note, reversal, or tax correction is introduced.

Review evidence of historical issued/paid invoice deletions against available backups
and audit/activity records before rollout. This change cannot restore deleted data,
does not infer missing history, and does not retroactively void invoices.

Disposable PostgreSQL 17 integration tests:

```bash
VOID_TEST_ADMIN_URL=postgres://USER:PASSWORD@127.0.0.1:PORT/h10_test_admin \
  npm test -- tests/invoice-void.test.ts
```

## Historical document snapshots (H11)

Migration `0003_document_snapshots.sql` adds nullable JSONB `document_snapshot`
columns to `invoices` and `quotes`. It performs no backfill or other data writes.
Apply it with the existing `npm run db:migrate` path before running the new code;
untracked canonical installations must first use the documented explicit baseline
process above. Earlier migrations and the invoice numbering sequence are unchanged.

New invoice snapshots freeze customer name/email/phone/address and business
name/email/phone/address/logo URL, registration/VAT details, banking details and
payment instructions. Quote snapshots contain the same rendered identity plus
service names/descriptions keyed by quote-item ID. Quantities, prices, totals,
dates and existing invoice item descriptions retain their existing storage and rules.
Operational WhatsApp preferences, ownership and subscription settings stay live.

Capture happens inside the status transaction when a draft invoice first becomes
sent, overdue or paid, including email/WhatsApp issuance. Quotes freeze on creation
as sent or on a draft-to-sent/accepted transition, including WhatsApp issuance.
Creation still accepts only draft/sent; explicit public acceptance still requires
sent. Reads never capture snapshots. Document row locks serialize issuance/retry;
scoped customer/business/service reads prevent copying another tenant's records.
A failure in either snapshot persistence or status persistence rolls back both.

Private/public document views and PDF exports use the same snapshot-aware detail
queries. Invoice CSV exports use the historical customer name/email as well.
An explicitly null snapshotted field remains null, rather than falling back to a
later value. Customer directory/statement headers remain current account identity;
a statement is not a reissued historical invoice. No statement amounts change.

Conversion uses an issued quote's stored identity and service wording alongside
its existing persisted quantities/prices/subtotals/total. The new draft invoice
inherits that identity and retains it when issued. Other drafts continue to show
live identity until issuance. Existing snapshots are never replaced, even if a
quote is returned to draft under its existing status workflow. Paid/overdue/void
transitions retain snapshots; void presentation still suppresses collection details.

Legacy issued rows with null snapshots retain the existing current-record fallback.
Later payment, overdue, void or acceptance does not reconstruct their missing
history. Legacy quote conversion uses the available current wording, as before;
it cannot prove the original agreement. If a legacy quote is deliberately returned
to draft and reissued, a new snapshot records that reissuance's current details,
not reconstructed original history. No automatic backfill is provided.

Logo replacement/removal retains a blob referenced by a stored document snapshot.
Unreferenced old logos retain existing deletion behavior. Retained images increase
storage use; external deletion or modification of an image URL can still affect
rendering, so blob retention must accompany database backups. Snapshot capture
adds short row/share locks and small JSON storage; no caching or reporting system
is introduced. Deploy migration and code together without leaving old writers
running, since old application versions do not capture newly issued documents.

Before deployment, perform a read-only review of existing issued quotes/invoices
against retained PDFs, sent documents and available backups to identify uncertain
historical identity or wording. Null snapshots cannot prove previous customer,
business, bank, service or logo values. Do not populate them from current records
and claim historical accuracy. Financial amounts require no recalculation for H11.

Disposable PostgreSQL 17 integration tests:

```bash
DOCUMENT_TEST_ADMIN_URL=postgres://USER:PASSWORD@127.0.0.1:PORT/h11_test_admin \
  npm test -- tests/document-snapshots.test.ts
```

## Password recovery and Auth.js session revocation (H14)

Migration `0004_user_session_version.sql` adds `users.session_version`, an integer
with default zero and NOT NULL. It changes no password, verification timestamp,
reset-token row or prior migration. Apply the migration before the new application
code using the existing production migration command. Existing untracked canonical
installations must use the documented explicit baseline path first.

Recovery locks the token's user inside the password-change transaction, then
conditionally claims the specific hashed token only if unused and unexpired.
Expiry is tested with PostgreSQL `clock_timestamp()` after waiting for the lock;
transaction-start time cannot extend token eligibility. Only a successful claim
can proceed to bcrypt hashing/password persistence and increment `session_version`.
The existing one-hour token lifetime, bcrypt cost 12, reset email-verification
behavior and invalidation of the user's other outstanding recovery tokens remain.
All writes commit or roll back together. Other users are unaffected.

Credentials login records the session version read alongside the password hash.
Every server-side Auth.js JWT callback checks that version against the current
user row, including direct `auth()` calls and the session API. A mismatch or missing
user returns no session. A login that verified an old password while reset was
committing cannot acquire a newer version by reading it later. Session refresh
never upgrades an old token or trusts a client-submitted version.

Existing JWTs without a version are treated as version zero. Rollout alone does
not sign out existing users. A successful reset increments only that account's
version, invalidating all its older Auth.js sessions on subsequent server checks;
new-password login receives the new version. Existing session lifetime and logout
cookie behavior remain unchanged. Unverified users still fail `requireUser` until
verified; password reset retains the existing verification behavior.

The Edge middleware remains a preliminary cryptographic cookie check without a
PostgreSQL connection. Protected dashboard pages/actions use server guards, and
protected APIs use the server `auth()` path; these enforce revocation. Public share
tokens remain independent of account login, with their existing access rules.
Already-authorized in-flight requests are not retroactively cancelled. Each
server-side authenticated session check adds one indexed user lookup and fails
closed if it cannot validate against the database.

Complete rollout across all Next.js instances before relying on revocation; old
application instances do not perform the version check. There is no forced global
logout or retrospective reconstruction of password-change history. No production
user-data correction is required for this migration.

The inspected Next.js frontend does not use the separate Java bearer-token login
or validation path. Java code is unchanged; this change revokes Auth.js sessions,
not independently issued Java bearer tokens.

Disposable PostgreSQL 17 integration tests use real Auth.js credentials handlers,
CSRF checks, encrypted cookies, session callbacks, bcrypt and protected route guards:

```bash
RESET_TEST_ADMIN_URL=postgres://USER:PASSWORD@127.0.0.1:PORT/h14_test_admin \
  npm test -- tests/password-reset-integration.test.ts
```

## Billing intentionally disabled

Keep `BILLING_ENFORCEMENT=off`. It is the shared master opt-in for the Next.js
billing entry points/access rules and Java billing entry points. Missing, blank,
malformed and non-exact values remain disabled; only exact `on` enables billing.
Configured PayFast credentials or plan prices alone do not enable anything.
The example environment and CI configuration retain `off`; real environment
files are not modified by this change.

While disabled:

- Next.js `GET /api/payfast/checkout` and `POST /api/payfast/notify` return 404
  with `Cache-Control: no-store` before authentication, body parsing, signature
  validation, rate-limit/audit writes, database access or network calls.
- The checkout server action returns to `/dashboard/billing`; the billing page
  does not render the checkout panel, payment buttons or checkout forms.
- Billing access checks allow authenticated users regardless of expired trial,
  cancelled, past-due or expired subscription dates. `KEY_FEATURE_TRIAL_LOCK`
  only applies when billing itself is enabled. Authentication and ownership
  checks still apply. Stored subscription statuses/dates are not rewritten.
- Java does not register `/api/webhooks/payfast` or `PaymentVerificationJob`.
  The job's existing 15-minute schedule therefore cannot change subscriptions.
  The condition is checked at application startup; restart/rebuild is needed
  when deploying these source changes or changing the runtime setting.

Checked production Compose configuration runs Next.js and migrations, not Java.
Java security permits unauthenticated `/api/webhooks/**` when its application is
run independently, so its webhook and scheduler are explicitly guarded too.
No other automatic billing writer/scheduler was found in application source,
scripts or CI. Recurring customer-invoice generation is separate and unchanged.

The existing payment calculations, signatures, validation, ITN processing and
subscription transition code remain dormant and unchanged. H12/H13 were not
implemented. Do not enable billing without a separate authorized payment review.
This flag does not cancel provider-side subscriptions or prevent charges from
previously created external payment instructions. No PayFast account, live VPS
configuration or production database was accessed to verify those external states.

Verification covers disabled routes with configured synthetic credentials/prices,
zero DB/network calls, absent checkout UI, authenticated access with expired
billing states, and Java bean absence. The full auth/financial regression suite
uses disposable PostgreSQL 17. Java condition tests run in an isolated build copy;
the local Java 21 override is test-only and does not change the Java 25 project
configuration. No schema migration is required.

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
