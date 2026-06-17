# TradeFlow SA

TradeFlow SA helps small South African service businesses manage customers, services, quotes, and invoices.

## Tech stack

- Spring Boot REST API backend in [backend](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/backend)
- JWT authentication for API clients
- Webhooks for Payfast and WhatsApp Cloud API
- External API calls for payment verification
- Background jobs for subscription/payment state checks
- Clean controller -> service -> repository backend structure
- Next.js App Router
- TypeScript
- Tailwind CSS
- Auth.js credentials auth
- PostgreSQL
- Drizzle ORM

## Setup

### Frontend

1. Copy `.env.example` to `.env.local`.
2. Fill in:
   - `DATABASE_URL`
   - `DATABASE_URL_UNPOOLED`
   - `NEXT_PUBLIC_APP_URL`
   - `AUTH_SECRET`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `PAYFAST_MERCHANT_ID`
   - `PAYFAST_MERCHANT_KEY`
   - `PAYFAST_PASSPHRASE`
   - `PAYFAST_PROCESS_URL`
   - `PAYFAST_VALIDATE_URL`
   - `PAYFAST_PLAN_STARTER_AMOUNT`
   - `PAYFAST_PLAN_PRO_AMOUNT`
   - `BLOB_READ_WRITE_TOKEN`
3. Create a PostgreSQL database.
4. Run the SQL in [supabase/schema.sql](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/supabase/schema.sql).
5. Install dependencies:

```bash
npm install
```

6. Start the app:

```bash
npm run dev
```

7. Open `http://localhost:3000`.

### Spring Boot API

The rebranded backend lives in [backend](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/backend).

Install Maven, then run:

```bash
cd backend
mvn spring-boot:run
```

The API starts on `http://localhost:8080` and uses the existing PostgreSQL schema from [supabase/schema.sql](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/supabase/schema.sql).

Important backend env vars:

- `DATABASE_URL`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `JWT_SECRET`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_VALIDATE_URL`
- `PAYFAST_PLAN_STARTER_AMOUNT`
- `PAYFAST_PLAN_PRO_AMOUNT`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`

Key API endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/{id}`
- `DELETE /api/customers/{id}`
- `POST /api/webhooks/payfast`
- `GET /api/webhooks/whatsapp`
- `POST /api/webhooks/whatsapp`

## Local Postgres

The repo now includes [docker-compose.yml](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/docker-compose.yml) for local PostgreSQL.

If you install Docker Desktop, you can start the database with:

```bash
docker compose up -d
```

Then apply the schema:

```bash
psql postgres://postgres:postgres@127.0.0.1:5432/tradeflow_sa -f supabase/schema.sql
```

The default local app config in [`.env.local`](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/.env.local) already points at that database.

## Database workflow

- The app uses plain PostgreSQL.
- The canonical schema file is [supabase/schema.sql](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/supabase/schema.sql).
- Drizzle schema lives in [lib/db/schema.ts](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/lib/db/schema.ts).
- For Neon:
  - `DATABASE_URL` should be the pooled connection string used by the live app.
  - `DATABASE_URL_UNPOOLED` should be the direct connection string used for schema tools.
- Optional Drizzle commands:

```bash
npm run db:generate
npm run db:push
```

## Neon Production

Neon is the recommended production database target for this repo.

1. Create a Neon project and database.
2. Copy the pooled Neon connection string into `DATABASE_URL`.
3. Copy the direct Neon connection string into `DATABASE_URL_UNPOOLED`.
4. Apply the schema:

```bash
psql "$DATABASE_URL_UNPOOLED" -f supabase/schema.sql
```

5. Set the same env vars in your hosting platform.

Neon recommends pooled connections for app traffic and direct connections for tooling such as migrations.
Sources:
- https://neon.com/docs/get-started-with-neon/connect-neon
- https://neon.com/docs/guides/vercel/

## Vercel Deployment

This app is ready for standard Next.js deployment on Vercel.

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. Import the repo into Vercel.
3. In Vercel Project Settings, add these environment variables for `Production`:
   - `DATABASE_URL`
   - `DATABASE_URL_UNPOOLED`
   - `AUTH_SECRET`
   - `NEXT_PUBLIC_APP_URL`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `PAYFAST_MERCHANT_ID`
   - `PAYFAST_MERCHANT_KEY`
   - `PAYFAST_PASSPHRASE`
   - `PAYFAST_PROCESS_URL`
   - `PAYFAST_VALIDATE_URL`
   - `PAYFAST_PLAN_STARTER_AMOUNT`
   - `PAYFAST_PLAN_PRO_AMOUNT`
   - `BLOB_READ_WRITE_TOKEN`
4. Set `NEXT_PUBLIC_APP_URL` to your production domain, for example `https://your-app.vercel.app`.
5. Deploy.

Recommended preview setup:

- Add preview values for:
  - `DATABASE_URL`
  - `DATABASE_URL_UNPOOLED`
  - `AUTH_SECRET`
- You can omit `NEXT_PUBLIC_APP_URL` in previews because the app falls back to `VERCEL_URL`.

Useful Vercel workflow commands:

```bash
vercel
vercel --prod
vercel env pull .env.local
```

Vercel notes that environment variables apply to the next deployment after you add or change them, and `vercel env pull` can sync development values locally.
Sources:
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/cli/env
- https://vercel.com/docs/frameworks/nextjs

## Email Confirmation Deployment

Before charging customers, confirm the production email-confirmation path is live.

1. Apply the dedicated Neon migration:

```bash
psql "$DATABASE_URL_UNPOOLED" -f supabase/migrations/20260617_email_confirmation.sql
```

2. Set production email env vars in Vercel:
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `NEXT_PUBLIC_APP_URL`

3. Redeploy production after the env vars are saved.
4. Register a test account with an inbox you control.
5. Confirm that the inbox receives the email, the `/verify-email?token=...` link marks the account verified, and login is blocked before confirmation but succeeds after confirmation.

In production, missing `RESEND_API_KEY` or `EMAIL_FROM` now fails registration instead of silently logging a confirmation link.

## Logo Uploads

Business logo uploads use Vercel Blob.

1. Create a Blob store in Vercel.
2. Add `BLOB_READ_WRITE_TOKEN` to your environment variables.
3. Open `/dashboard/settings` in the app.
4. Upload a PNG or JPEG logo.

The uploaded logo is stored on the business profile and rendered on invoice views and invoice PDFs.

Source:
- https://vercel.com/docs/storage/vercel-blob

## Payfast Billing

This repo includes a Payfast billing foundation:

- Payfast checkout redirection from the billing page
- ITN handling for payment validation and subscription sync
- Billing-based access control for dashboard workflows

Required Payfast setup:

1. Create or use a Payfast merchant account.
2. Set:
   - `PAYFAST_MERCHANT_ID`
   - `PAYFAST_MERCHANT_KEY`
   - `PAYFAST_PASSPHRASE`
   - `PAYFAST_PLAN_STARTER_AMOUNT`
   - `PAYFAST_PLAN_PRO_AMOUNT`
3. Add an ITN endpoint:

```text
https://your-domain.com/api/payfast/notify
```

4. Re-run [supabase/schema.sql](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/supabase/schema.sql) so the billing columns exist.
5. Confirm recurring billing is enabled if you later move beyond manual monthly renewals.

Sources:
- https://payfast.io/features/subscriptions/
- https://payfast.io/faq/merchant-faqs/
- https://status.payfast.io/

## Auth flow

- Register creates a local `users` record, hashes the password, then creates a `businesses` row.
- Login uses Auth.js credentials auth.
- Middleware protects `/dashboard/**`.
- Logout clears the session and redirects to `/login`.

## Features included

- Credentials authentication and protected dashboard routes
- Dashboard metrics and recent quotes
- Customer CRUD
- Service CRUD
- Quote create, list, and detail view
- Invoice list, detail view, and quote-to-invoice conversion
- Public invoice route and PDF invoice downloads
- WhatsApp share links for invoices
- Overdue invoice automation
- Responsive dashboard layout

## Notes

- The current app assumes one business per signed-in user.
- Access control is enforced in application code instead of database RLS.
- Public invoice pages and PDF downloads are still available without signing in.
