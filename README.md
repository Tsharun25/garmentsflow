# GarmentFlow ERP

Woven and Knit ERP under development. The new brief is [PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md). This delivery adds the PostgreSQL identity/factory-workspace slice. It is not a complete ERP or production/marketplace release.

## Requirements

Node 24 LTS, npm and PostgreSQL 18 for the API. No database is needed for the fictional dashboard. Tests start a disposable real PostgreSQL instance without Docker. Browser tests use installed Chrome on Windows; elsewhere run `npx playwright install --with-deps chromium` first.

## Quick start (PowerShell)

```powershell
npm ci
npm run dev:web
```

Open the URL Vite prints, normally http://127.0.0.1:5173.

In a separate terminal, configure the API:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
# Privately configure the environment as described below.
npm run db:migrate -w @garmentflow/api
npm run dev:api
```

Create a dedicated PostgreSQL database owned by a migration role and a distinct non-owner runtime login, without superuser/BYPASSRLS privileges. Configure `DATABASE_URL` (runtime), `MIGRATION_DATABASE_URL` (schema owner), `RUNTIME_DATABASE_ROLE`, `SESSION_SECRET` (48+ random characters) and `CLIENT_URL=http://127.0.0.1:5173` privately in apps/api/.env. Placeholder secrets are rejected. The runtime never uses the migration URL and startup rejects a table-owning/superuser/BYPASSRLS runtime role.

Before login, provision Main Admin through private environment variables: `PROVISION_TENANT_SLUG`, `PROVISION_TENANT_NAME`, `PROVISION_ADMIN_EMAIL`, `PROVISION_ADMIN_PASSWORD` (14–128 characters), and `DEPLOYMENT_MODE` (`single-business` or `saas`). Run `npm run db:provision -w @garmentflow/api`. Do not put credentials in command arguments or shared transcripts. Provisioning creates an initial factory. Open **Open live workspace** and use your privately provisioned account.

API loads apps/api/.env explicitly; CLI commands execute in that workspace. Existing terminal variables take precedence. Never share or commit credentials.

API: `GET /api/v1/health` is liveness; `GET /api/v1/ready` is database readiness. Startup requires migrated PostgreSQL and valid runtime grants. Native development binds to loopback. Admin MFA/recovery/invitations remain pending, so keep this foundation internal. Sessions expire after eight hours and are revoked on logout or membership disable. No refresh tokens are used.

## Verification

```powershell
npm run verify
```

Runs formatting, ESLint, strict TypeScript (including tests/scripts), unit tests, real PostgreSQL integration/browser tests and builds. The test harness uses random credentials, synthetic tenants, a non-superuser migration owner and a separate runtime role. It creates/removes only its own uniquely named test databases/roles. `TEST_ADMIN_DATABASE_URL` may select an external test server; it never resets the supplied database. Screenshots and disposable test data are ignored under `.local`. Run `npm audit` separately for dependency advisories.

## Implemented

- React/Vite/TypeScript/Tailwind/TanStack Query frontend; Express/PostgreSQL/Zod API.
- Responsive sample dashboard, search, Woven/Knit filters, order detail and CSV export.
- Security headers, structured API errors, configuration validation, health/readiness and shutdown handling.
- Shared type definitions for manufacturing and deployment modes.
- Argon2id passwords, signed opaque HttpOnly sessions, CSRF/Origin checks and login rate limits.
- Main Admin provisioning, exact tenant/factory/department access, last-admin protection and membership disable.
- Persisted factory work notes with transactional audit; forced tenant RLS and composite foreign keys.

Work notes do not post stock, production or shipments. Employee invitations and role-management UI are not delivered; do not share Main Admin accounts as a substitute.

## Local Docker source (execution unverified)

Copy root `.env.example` to `.env` and privately replace the three values with separate random hexadecimal secrets. Run `docker compose up --build`. Migrations run before API startup; web binds to http://127.0.0.1:8080. Provision through a one-off migration container supplied the private provisioning environment. Database data is retained in a named volume. Editing environment values does not rotate an existing database role. Docker execution, TLS, production images and backup/restore remain unverified.

All dashboard records and metrics are fictional and held in frontend source. They are not database records. Sample dates are fixed, not a live schedule. Navigation to future modules shows their planned status.

## Not implemented

Admin MFA/recovery, employee invitations and role-assignment management, manufacturing workflows, inventory ledger, PO/BOM, handovers, shipment, licensing/subscriptions, legal entities and factory UAT remain unfinished. Single-business dedicated databases and shared SaaS are design targets; operational deployment rehearsals are pending. No MongoDB records were migrated or deleted. Baseline rollback is documented at [ADR 001](docs/decisions/001-postgresql-migration.md), referencing commit `1714a27`.

See [progress](docs/PROGRESS.md), [discovery](docs/DISCOVERY.md), [permissions](docs/PERMISSIONS.md), [ERD](docs/ERD.md), [posting rules](docs/POSTING_RULES.md), [marketplace gates](docs/VIBE96_RELEASE_CHECKLIST.md) and [verification report](docs/IMPLEMENTATION_REPORT.md). Confirm ownership and commercial terms before distribution; no open-source project licence is granted.
