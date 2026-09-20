# TradeFlow SA

Full-stack business management platform for service businesses, built with Next.js, Spring Boot, PostgreSQL, authentication, billing workflows, and webhooks.

TradeFlow SA helps small service businesses manage customers, services, quotes, and invoices from a single application. The project combines a modern frontend with a Spring Boot API and PostgreSQL persistence to support real operational workflows such as billing, customer records, and invoice generation.

## Overview

This application is designed for South African service businesses that need a simple way to:

- manage customer records
- track services and pricing
- create and send quotes
- generate invoices
- handle billing and subscription workflows
- manage business operations through a protected dashboard

The system includes both a user-facing web app and a backend API, with authentication, business logic, and data persistence separated across application layers.

## Features

- Customer management and CRUD workflows
- Service and pricing management
- Quote creation and invoice generation
- Public invoice pages and PDF exports
- Authentication with credentials and OAuth support
- Billing and subscription handling with Payfast integration
- WhatsApp webhook integration for communication workflows
- Dashboard metrics and operational views
- Responsive application layout for business users

## Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- Auth.js

### Backend
- Java
- Spring Boot
- REST APIs
- JWT authentication
- Webhooks

### Data and infrastructure
- PostgreSQL
- SQL schema management
- Drizzle ORM
- Docker
- Vercel deployment
- Linux server environment

## Architecture

The application is split between a Next.js frontend and a Spring Boot backend.

- The frontend handles the dashboard, customer workflow, billing pages, and user-facing interfaces.
- The backend exposes REST endpoints for authentication, customer management, billing verification, and webhook processing.
- PostgreSQL stores core business data and the application schema.
- Payment and messaging integrations use external APIs and webhook-driven processing.
- The app separates business logic from request handling through controller, service, and repository patterns.

## Screenshots

Add screenshots of:

- dashboard overview
- customer management
- quote and invoice workflow
- billing and subscription page
- login and authentication flow

## Getting Started

### Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Backend

```bash
cd backend
mvn spring-boot:run
```

The API runs on `http://localhost:8080` by default.

### Required environment variables

Configure the required environment variables for the frontend and backend, including:

- database connection values
- authentication secrets
- payment API values
- email configuration
- WhatsApp webhook configuration

## Testing

The project includes validation and quality checks for the application layer, including:

- linting
- TypeScript checks
- backend build validation
- environment-based verification for deployed workflows

Run the frontend checks as appropriate for the project setup:

```bash
npm run lint
npm run typecheck
npm test
```

## Deployment

The project is designed for deployment to modern hosting platforms:

- Vercel for the frontend
- PostgreSQL for database persistence
- Docker for local infrastructure workflows
- Render or similar hosting for API deployment when needed

The repository includes deployment guidance for the application environment, database configuration, and operational checks.

## What I Learned

This project helped me practice:

- full-stack application design
- API-first backend workflows
- authentication and authorization
- database-backed business logic
- external service integration
- deployment configuration and environment management
- documentation for a real-world application

## Future Improvements

- improve project documentation clarity and onboarding flow
- add more automated tests for core business workflows
- refactor long setup instructions into dedicated docs
- standardize environment configuration and deployment notes
- review project naming and repository polish for public presentation
