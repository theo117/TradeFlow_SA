# TradeFlow SA MVP

TradeFlow SA is a SaaS foundation for small South African service businesses to manage customers, services, quotes, and invoices.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Auth.js credentials auth
- PostgreSQL
- Drizzle ORM

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in:
   - `DATABASE_URL`
   - `DATABASE_URL_UNPOOLED`
   - `NEXT_PUBLIC_APP_URL`
   - `AUTH_SECRET`
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

- This MVP assumes one business per signed-in user.
- Access control is enforced in application code instead of database RLS.
- Public invoice pages and PDF downloads are still available without signing in.
