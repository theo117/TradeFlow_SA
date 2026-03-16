# TradeFlow SA MVP

TradeFlow SA is a SaaS foundation for small South African service businesses to manage customers, services, quotes, and invoices.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- PostgreSQL

## Folder structure

```text
.
|-- app
|   |-- (auth)
|   |   |-- actions.ts
|   |   |-- login/page.tsx
|   |   `-- register/page.tsx
|   |-- dashboard
|   |   |-- customers
|   |   |   |-- [id]/edit/page.tsx
|   |   |   |-- actions.ts
|   |   |   |-- new/page.tsx
|   |   |   `-- page.tsx
|   |   |-- invoices
|   |   |   |-- [id]/page.tsx
|   |   |   |-- actions.ts
|   |   |   `-- page.tsx
|   |   |-- quotes
|   |   |   |-- [id]/page.tsx
|   |   |   |-- actions.ts
|   |   |   |-- new/page.tsx
|   |   |   `-- page.tsx
|   |   |-- services
|   |   |   |-- [id]/edit/page.tsx
|   |   |   |-- actions.ts
|   |   |   |-- new/page.tsx
|   |   |   `-- page.tsx
|   |   |-- layout.tsx
|   |   `-- page.tsx
|   |-- invoice
|   |   `-- [id]/page.tsx
|   |-- api
|   |   `-- invoices/[id]/pdf/route.ts
|   |-- globals.css
|   |-- layout.tsx
|   |-- not-found.tsx
|   `-- page.tsx
|-- components
|   |-- auth
|   |-- dashboard
|   |-- forms
|   |-- quotes
|   `-- ui
|-- hooks
|-- lib
|   |-- supabase
|   |-- auth.ts
|   |-- queries.ts
|   |-- types.ts
|   |-- utils.ts
|   `-- validations.ts
|-- supabase/schema.sql
|-- middleware.ts
`-- .env.example
```

## Database schema

Run [schema.sql](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/supabase/schema.sql) in the Supabase SQL editor.

Core tables:

- `businesses`: one business per auth user in the MVP.
- `customers`: belongs to a business.
- `services`: belongs to a business.
- `quotes`: belongs to a business and customer.
- `quote_items`: belongs to a quote and service.
- `invoices`: belongs to a business and customer, optionally linked to a quote.
- `invoice_items`: belongs to an invoice and stores the final billed line items.

## Supabase setup

1. Create a Supabase project.
2. In Supabase Authentication, enable Email auth.
3. For the simplest MVP onboarding flow, disable mandatory email confirmation while testing, or adjust the register flow to handle pending verification.
4. Run the SQL in [schema.sql](/c:/Users/theod/Documents/Java%202025/business/New%20folder/TradeFlow_SA/supabase/schema.sql).
5. Copy `.env.example` to `.env.local`.
6. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
7. Install dependencies:

```bash
npm install
```

8. Start the app:

```bash
npm run dev
```

9. Open `http://localhost:3000`.

## Auth flow

- Register creates a Supabase user, then inserts a `businesses` row.
- Login uses Supabase password auth.
- Middleware protects `/dashboard/**`.
- Logout signs out and redirects to `/login`.

## Example database queries

Dashboard counts:

```ts
const [{ count: customerCount }, { count: quoteCount }] = await Promise.all([
  supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id),
  supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id)
]);
```

Fetch quotes with customer data:

```ts
const { data: quotes } = await supabase
  .from("quotes")
  .select("id, total, status, created_at, customer:customers(id, name, email, phone)")
  .eq("business_id", business.id)
  .order("created_at", { ascending: false });
```

Create a quote and quote items:

```ts
const { data: quote } = await supabase
  .from("quotes")
  .insert({
    business_id: business.id,
    customer_id: payload.customerId,
    status: payload.status,
    total
  })
  .select("id")
  .single();

await supabase.from("quote_items").insert(
  payload.items.map((item) => ({
    quote_id: quote.id,
    service_id: item.service_id,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal
  }))
);
```

Convert a quote into an invoice:

```ts
const { data: invoice } = await supabase
  .from("invoices")
  .insert({
    business_id: business.id,
    customer_id: quote.customer_id,
    quote_id: quote.id,
    total: quote.total,
    due_date: payload.dueDate
  })
  .select("id, invoice_number")
  .single();

await supabase.from("invoice_items").insert(
  quote.items.map((item) => ({
    invoice_id: invoice.id,
    service_id: item.service_id,
    description: item.service?.name ?? "Service",
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal
  }))
);
```

Fetch invoices with customer data:

```ts
const { data: invoices } = await supabase
  .from("invoices")
  .select(
    "id, invoice_number, status, total, due_date, created_at, customer:customers(id, name, email, phone)"
  )
  .eq("business_id", business.id)
  .order("created_at", { ascending: false });
```

Sync overdue invoices:

```ts
await supabase.rpc("sync_overdue_invoices", {
  target_business_id: business.id
});
```

## Features included

- Supabase authentication and protected dashboard routes
- Dashboard metrics and recent quotes
- Customer CRUD
- Service CRUD
- Quote create, list, and detail view
- Invoice list, detail view, and quote-to-invoice conversion
- Public invoice route and PDF invoice downloads
- WhatsApp share links for invoices
- Overdue invoice automation
- Responsive sidebar-style dashboard layout

## Notes

- This MVP assumes one business per signed-in user.
- Edit and delete are implemented for customers and services.
- Quotes support create, list, and view.
- Public invoice pages and PDF downloads use `SUPABASE_SERVICE_ROLE_KEY` server-side.
