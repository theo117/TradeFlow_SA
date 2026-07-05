# Email Domain Checklist

Before inviting paying users, configure the sender domain used by `EMAIL_FROM`.

## DNS

- SPF includes the email provider.
- DKIM is verified in the provider dashboard.
- DMARC exists with at least `p=none` while testing.
- The `From` domain matches the authenticated sending domain.

## Functional Checks

- Register a new account and receive confirmation.
- Confirm the account and log in.
- Request a password reset and receive it.
- Confirm unknown password-reset emails show the same success message.
- Check spam placement for Gmail, Outlook, and a custom domain inbox.

## Monitoring

Review provider dashboards weekly for:

- Bounce rate
- Spam complaint rate
- Delivery failures
- Domain authentication drift
