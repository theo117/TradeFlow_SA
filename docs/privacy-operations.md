# Privacy Operations

TradeFlow SA stores customer contact details, invoices, quotes, business profile information, public share-token metadata, and audit events. Treat this as personal information.

## Customer Requests

For access/export requests:

- Export customers from `/api/export/customers`.
- Export invoices from `/api/export/invoices`.
- Include quote and invoice PDFs when requested.
- Include audit history only when appropriate and safe.

For deletion requests:

- Confirm the account owner identity.
- Export a final copy if requested.
- Delete or anonymize customers, quotes, invoices, public share tokens, and business profile data.
- Keep only records legally required for tax, fraud, or dispute handling.

## Retention

Recommended defaults:

- Public share tokens expire by `PUBLIC_LINK_TTL_HOURS`.
- Password reset tokens expire after 1 hour.
- Email verification tokens expire after 24 hours.
- Audit events are kept for security and dispute investigation.

## Launch Legal Checks

- Privacy page names the operator, contact email, data categories, purpose, retention, and user rights.
- Terms page explains billing, acceptable use, support, and limitation of liability.
- Support inbox is monitored.
