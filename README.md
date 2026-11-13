# GarmentFlow ERP

Manufacturing ERP foundation for woven and knit factories. Version 0.1.0 is a development foundation, not a complete ERP or marketplace release.

## Requirements
Node.js 22.12+ (Node 24 LTS recommended), npm, and MongoDB for the API. No database is needed for the fictional frontend preview.

## Quick start (PowerShell)
```powershell
npm ci
npm run dev:web
```
Open the URL Vite prints, normally http://127.0.0.1:5173.

In a separate terminal, configure the API:
```powershell
Copy-Item apps/api/.env.example apps/api/.env
# Configure MONGODB_URI privately in apps/api/.env.
Set-Location apps/api
npm run dev
```
The API loads apps/api/.env explicitly. You can also run `npm run dev:api` at the project root. Environment variables already set in the terminal take precedence. Never share or commit credentials.

API: `GET /api/v1/health` is liveness; `GET /api/v1/ready` is database readiness. The server requires a successful MongoDB connection before it starts. Development binds to loopback only. Do not expose this unauthenticated foundation as a production ERP.

## Verification
```powershell
npm run verify
```
Runs strict TypeScript, API tests, and both production builds. Tests use an injected database-readiness probe, not a real MongoDB instance.

## Implemented
- npm workspace: React 19 / Vite / strict TypeScript / Tailwind 4 frontend, Express 5 / Mongoose / Zod API.
- Responsive sample dashboard, search, Woven/Knit filters, order detail and CSV export.
- Security headers, structured API errors, configuration validation, health/readiness and shutdown handling.
- Shared type definitions for manufacturing and deployment modes.

All dashboard records and metrics are fictional and held in frontend source. They are not database records. Sample dates are fixed, not a live schedule. Navigation to future modules shows their planned status.

## Not implemented
Authentication, tenants, RBAC, business CRUD, inventory ledger, production operations, audit log, SaaS billing, licensing and production deployment. Single-business and SaaS are design targets, not supported editions yet. TanStack Query, additional validation/permission packages and job queues will be added when used.

See [roadmap](docs/ROADMAP.md), [marketplace gates](docs/VIBE96_RELEASE_CHECKLIST.md) and [verification report](docs/IMPLEMENTATION_REPORT.md). Source ownership and final commercial terms must be confirmed by the owner before distribution. No open-source project license is granted by this repository.
