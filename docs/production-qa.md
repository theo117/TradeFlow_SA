# Production QA Pass

Use this checklist before moving beyond pilots. Run it against the deployed app and the live Neon/Vercel environment you intend to charge customers on.

## Preflight

- Confirm Neon migrations are applied:
  - `supabase/migrations/20260617_email_confirmation.sql`
  - `supabase/migrations/20260618_password_recovery.sql`
- Confirm Vercel Production env vars are set:
  - `DATABASE_URL`
  - `DATABASE_URL_UNPOOLED`
  - `NEXT_PUBLIC_APP_URL`
  - `AUTH_SECRET`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `PUBLIC_LINK_SECRET`
  - `BLOB_READ_WRITE_TOKEN`
  - Payfast vars if billing QA is in scope
- Confirm `NEXT_PUBLIC_APP_URL` exactly matches the production domain.
- Keep `BILLING_ENFORCEMENT=off` unless actively testing lockout behavior.
- Open Vercel Runtime Logs and be ready to search by `message`, `requestId`, `businessId`, `quoteId`, `invoiceId`, and `paymentId`.

## Test Data

- Test owner email: an inbox you control.
- Business name: `QA TradeFlow Services`.
- Customer name: `QA Customer`.
- Customer email: an inbox you control or a mail test inbox.
- Customer phone: a valid South African test number if WhatsApp is in scope.
- Service name: `QA Site Visit`.
- Service price: `199.00`.
- Logo: PNG or JPEG under 2 MB.

## 1. Register

Steps:

1. Open `/register`.
2. Register with the test business, email, and a 10+ character password.
3. Confirm the app sends you to `/verify-email?sent=1`.

Expected:

- User cannot log in before confirmation.
- `users.email_verified_at` is `null`.
- Vercel logs include `Registration created pending email verification`.
- `audit_events` includes `auth.register_pending_email_verification`.

## 2. Confirm Email

Steps:

1. Open the confirmation email.
2. Click the `/verify-email?token=...` link.
3. Log in with the new account.

Expected:

- Verification page says the account is confirmed.
- `users.email_verified_at` is populated.
- Login succeeds and lands on `/dashboard`.
- Vercel logs include `Login succeeded`.

## 3. Create Customer

Steps:

1. Open `/dashboard/customers/new`.
2. Create `QA Customer` with email, phone, WhatsApp phone, opt-in, and address.

Expected:

- Customer appears in `/dashboard/customers`.
- `customers` has the new row linked to the test business.
- `activity_events` includes `customer.created`.

## 4. Create Service

Steps:

1. Open `/dashboard/services/new`.
2. Create `QA Site Visit` at `199.00`.

Expected:

- Service appears in `/dashboard/services`.
- `services` has the new row linked to the test business.

## 5. Create Quote

Steps:

1. Open `/dashboard/quotes/new`.
2. Select `QA Customer`.
3. Add `QA Site Visit`, quantity `1`.
4. Save the quote as draft.
5. Open the quote detail page.

Expected:

- Quote total is `R199.00`.
- Quote detail page loads.
- Quote PDF downloads from `/api/quotes/:id/pdf`.
- Public quote link opens.
- `activity_events` includes `quote.created`.
- Vercel logs include `Quote PDF generated` when the PDF is downloaded.

## 6. Send Quote

Steps:

1. On the quote detail page, click `Email`.
2. Confirm the mail client draft includes the public quote link.
3. If WhatsApp is configured, click `Send via WhatsApp`.
4. Mark the quote as sent or accepted.

Expected:

- Quote status updates correctly.
- Public link remains accessible.
- WhatsApp falls back to a manual draft if Cloud API is not configured.
- `activity_events` includes quote status or delivery events where applicable.

## 7. Convert Quote To Invoice

Steps:

1. On the quote detail page, choose a due date.
2. Click `Convert to invoice`.
3. Open the generated invoice detail page.

Expected:

- Invoice is created once; clicking convert again opens the existing invoice.
- Invoice line items match the quote.
- Invoice total is `R199.00`.
- `activity_events` includes `invoice.created`.

## 8. Send Invoice

Steps:

1. On the invoice detail page, click `Send via Email`.
2. Confirm the mail draft includes the public invoice link.
3. If WhatsApp is configured, click `Send via WhatsApp`.
4. Mark invoice as sent.

Expected:

- Draft invoice becomes sent.
- Customer-facing invoice link opens.
- `activity_events` includes `invoice.reminder_sent` or delivery events.

## 9. Upload Logo

Steps:

1. Open `/dashboard/settings`.
2. Upload a PNG or JPEG under 2 MB.
3. Save the business profile.
4. Open a quote or invoice PDF.

Expected:

- Settings page saves successfully.
- `businesses.logo_url` is populated.
- Logo appears in generated PDFs.
- If logo rendering fails, Vercel logs include `Invoice PDF logo fetch failed`, `Invoice PDF logo embed failed`, `Quote PDF logo fetch failed`, or `Quote PDF logo embed failed`.

## 10. Download Invoice PDF

Steps:

1. Open the invoice detail page.
2. Click `Download PDF`.
3. Open the downloaded file.

Expected:

- PDF downloads with the invoice number filename.
- PDF contains business details, customer details, invoice number, due date, line items, total, and logo.
- Vercel logs include `Invoice PDF generated`.

## 11. Password Recovery

Steps:

1. Log out.
2. Open `/forgot-password`.
3. Submit the test owner email.
4. Click the reset email link.
5. Set a new password.
6. Confirm old password fails and new password works.
7. Try reusing the reset link.

Expected:

- Unknown emails show the same success message as known emails.
- Reset link expires after 1 hour.
- Reused reset link is rejected.
- `audit_events` includes `auth.password_reset_requested` and `auth.password_reset_completed`.

## 12. Billing Checkout

Run this only when Payfast sandbox or production credentials are ready.

Steps:

1. Keep `BILLING_ENFORCEMENT=off`.
2. Open `/dashboard/billing`.
3. Start Starter checkout.
4. Complete Payfast sandbox payment.
5. Confirm Payfast calls `/api/payfast/notify`.
6. Repeat for Pro checkout.

Expected:

- Payfast receives recurring subscription fields.
- Successful ITN sets:
  - `billing_provider=payfast`
  - `billing_plan_id`
  - `billing_subscription_id`
  - `subscription_status=active`
  - `current_period_end`
- Vercel logs include `Payfast ITN processed`.

## 13. Failed And Cancelled Billing

Run this only when Payfast sandbox can simulate failure/cancellation.

Steps:

1. Trigger or simulate a failed ITN.
2. Trigger or simulate a cancelled ITN.
3. Set `BILLING_ENFORCEMENT=on` only after status updates are confirmed.
4. Try to access paid workflow pages, such as creating a quote.

Expected:

- Failed ITN sets `subscription_status=past_due`.
- Cancelled ITN sets `subscription_status=cancelled`.
- With enforcement on, paid workflows redirect to `/dashboard/billing?error=Billing%20required`.
- Vercel logs include `Billing access denied`.

## Sign-Off

| Area | Pass/Fail | Notes |
| --- | --- | --- |
| Register |  |  |
| Email confirmation |  |  |
| Login |  |  |
| Customer CRUD |  |  |
| Service CRUD |  |  |
| Quote creation |  |  |
| Quote send/share |  |  |
| Invoice conversion |  |  |
| Invoice send/share |  |  |
| Logo upload |  |  |
| Quote PDF |  |  |
| Invoice PDF |  |  |
| Password recovery |  |  |
| Billing checkout |  |  |
| Failed/cancelled billing |  |  |
| Access control |  |  |

Do not broadly launch paid access until every row is passed or has an explicitly accepted risk.
