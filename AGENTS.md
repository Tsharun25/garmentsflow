# GarmentFlow ERP — Agent Instructions

## Project mission

Build GarmentFlow ERP, a reliable garment manufacturing ERP for Woven and Knit factories. The same codebase must support:

1. A single-business licensed deployment.
2. A multi-tenant SaaS deployment.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS.
- Backend: Node.js, Express, TypeScript.
- Database: PostgreSQL with node-postgres; versioned SQL migrations and forced RLS.
- Validation: Zod.
- Data fetching: TanStack Query.
- Background jobs: Redis and BullMQ when required.
- Deployment: Docker-based deployment, with production secrets kept outside source control.

## Working rules

1. Inspect the existing code before changing anything.
2. Do not replace working architecture without explaining why and asking first.
3. Work in small, reviewable steps. Do not generate the whole ERP in one response.
4. Before editing, state the files you intend to create or change and why.
5. After editing, summarise the changes and provide commands to verify them.
6. Run relevant type checks, linting, and tests when available. Never claim a check passed unless it was actually run and passed.
7. Do not silently remove existing features, files, validation, tests, or security controls.
8. Do not install a dependency unless it is needed. Explain why it is needed.
9. Use strict TypeScript. Avoid `any`; explain any unavoidable use.
10. Keep naming consistent and code readable for a developer learning the project.

## Multi-tenant security — critical

1. Every tenant-owned database record must have a `tenantId`.
2. Never trust a tenantId supplied by the browser or request body.
3. Determine the tenant from the authenticated, validated server-side user/session context.
4. Every tenant-owned read, update, and delete must be scoped to the authenticated tenant.
5. Check tenant ownership before accessing related records.
6. Add tests proving Tenant A cannot read, edit, delete, or reference Tenant B data.
7. Use compound indexes and unique constraints that include tenantId where appropriate.
8. Do not create an endpoint that bypasses tenant scoping for convenience.

## Authentication and permissions

- Use secure, HttpOnly cookies for session/refresh credentials where appropriate.
- Never store authentication tokens in localStorage.
- Use password hashing such as Argon2id or bcrypt with appropriate settings.
- Implement refresh-token rotation and revocation safely.
- Protect cookie-based state-changing requests against CSRF.
- Add rate limiting to login, password reset, and other sensitive endpoints.
- Enforce role-based permissions on the backend, not only in the UI.
- Do not log passwords, tokens, cookies, database URIs, or secrets.

## Garment domain

- Support both Woven and Knit workflows through configurable process routing.
- Avoid duplicating the entire application for Woven and Knit.
- Keep production, inventory, quality, costing, commercial, and shipment data traceable.
- Use stock transactions/ledger entries instead of silently overwriting stock balances.
- Preserve audit history for important business actions.

## Data and API

- Validate all external input on the server.
- Use consistent API response and error formats.
- Use pagination and filtering for large lists.
- Use PostgreSQL transactions on a single pooled connection for business commands and transaction-local tenant context.
- Add indexes based on actual query patterns.
- Keep secrets in environment variables and never commit `.env` files.

## Before finishing a task

Report:

1. What changed.
2. Which files changed.
3. Important design decisions.
4. Commands/tests actually run and their real results.
5. Any known limitations or follow-up work.

## Updated product brief (owner authorized 2026-11-13)

Follow docs/PRODUCT_BRIEF.md. Preserve the sample dashboard. Deliver one verified vertical slice at a time; record unverified exit criteria in docs/PROGRESS.md. Runtime roles must not own tenant tables or bypass RLS. Factory and tenant scopes must be enforced independently.
