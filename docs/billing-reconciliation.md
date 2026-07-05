# Billing Reconciliation

Billing enforcement stays off for now:

```env
BILLING_ENFORCEMENT=off
```

## Before Enabling Enforcement

Pass these checks with PayFast sandbox or live test payments:

- Checkout creates a PayFast subscription for Starter and Pro.
- PayFast calls `/api/payfast/notify`.
- `payfast_itn_events` stores invalid, ignored, duplicate, and processed events.
- A successful ITN sets `subscription_status=active`.
- Failed and cancelled ITNs set `past_due` and `cancelled`.
- Duplicate ITNs do not extend or change billing twice.
- Vercel logs contain `Payfast ITN processed` for real processed events.

## Reconciliation Query

Use this query after payment testing:

```sql
select
  received_at,
  processed_at,
  validation_status,
  ignored_reason,
  payment_id,
  pf_payment_id,
  business_id,
  plan,
  payment_status,
  amount_gross
from public.payfast_itn_events
order by received_at desc
limit 100;
```

Compare each processed `pf_payment_id` with PayFast's merchant dashboard.

## Enablement Rule

Only set `BILLING_ENFORCEMENT=on` after:

- Production env vars are complete.
- PayFast webhook replay/duplicate behavior is verified.
- Failed and cancelled states have been tested.
- Support is ready to manually override customer access if PayFast has an outage.
