# TradeFlow API

Spring Boot REST API backend for TradeFlow SA.

## What this backend demonstrates

- Spring Boot REST controllers
- JWT authentication with stateless Spring Security
- Webhooks for Payfast and WhatsApp Cloud API
- External API calls with `WebClient`
- Background jobs with `@Scheduled`
- Clean controller -> service -> repository structure
- PostgreSQL persistence using Spring Data JPA

## Run locally

Install Maven, then start the API from this folder:

```bash
mvn spring-boot:run
```

The API runs on `http://localhost:8080` by default.

## Environment

```bash
DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/tradeflow_sa
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
JWT_SECRET=replace-this-with-at-least-32-characters
JWT_ISSUER=tradeflow-api
PAYFAST_PASSPHRASE=
PAYFAST_VALIDATE_URL=https://www.payfast.co.za/eng/query/validate
PAYFAST_PLAN_STARTER_AMOUNT=0.00
PAYFAST_PLAN_PRO_AMOUNT=0.00
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
```

This backend validates against the existing schema in `../supabase/schema.sql`.

## API slices

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/{id}`
- `DELETE /api/customers/{id}`
- `POST /api/webhooks/payfast`
- `GET /api/webhooks/whatsapp`
- `POST /api/webhooks/whatsapp`

Protected endpoints require:

```text
Authorization: Bearer <jwt>
```

## Architecture

Each feature is grouped by domain package:

- `auth`: REST controller, authentication service, request/response DTOs
- `customer`: REST controller, service, repository, entity, DTOs
- `billing`: Payfast webhook controller, webhook service, Payfast external API client, scheduled verification job
- `whatsapp`: webhook controller and signature-validating service
- `business`, `user`, `activity`: shared persistence models and repositories
