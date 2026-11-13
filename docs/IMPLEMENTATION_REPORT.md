# Implementation evidence

## Historical foundation: 2026-11-11

## Scope

Created apps/web (dashboard preview), apps/api (service foundation), packages/shared-types, strict TypeScript workspace configuration, lockfile, AGENTS.md from the supplied guide, README and release/roadmap documentation.

## Decisions

- Keep the requested React/Vite + Express/MongoDB architecture.
- Keep this first delivery bounded to the guide's first phase.
- No tenant-owned endpoint before authenticated tenancy and isolation tests exist.
- No authentication tokens or browser persistence; all UI records are fictional.
- Use an injected readiness callback for deterministic API unit/integration checks. This is not proof of a real database connection.
- Use local npm tooling and defer unused infrastructure dependencies.

## Verification

Verified on 2026-11-11:

- npm install completed; package-lock.json recorded.
- npm run verify passed: API and web strict TypeScript checks, 5 API tests, API compilation and frontend production build.
- npm audit passed with 0 reported vulnerabilities after updating Vitest to 5.1.0. This is dependency advisory evidence, not a full security audit.
- npm run dev:web started successfully; HTTP GET http://127.0.0.1:5173/ returned 200.
- Browser preview was attempted but the browser access host was unavailable. Visual layout, clicking, downloads, keyboard behavior and mobile layout remain unverified.
- No local mongod/Docker command or MongoDB listener on port 27017 was found. A real MongoDB connection and full API startup remain unverified.

No public deployment, marketplace submission, agreement signing or Git publication was performed.

## Remaining

Real MongoDB connection/startup verification, authentication/tenancy and all later ERP phases. Docker/VPS deployment, live demo, marketplace audit, screenshots and marketplace approval remain pending.

## New-guide delivery: 2026-11-13

### Implemented scope

- Owner-authorized PostgreSQL transition; MongoDB business data is neither read nor changed. Preserve baseline commit 1714a27 and follow ADR 001 for rollback/data-preservation limits.
- Drafted provisional discovery maps, approval/handover ownership, ERD, posting rules, route permissions and outstanding pilot decisions.
- Added versioned SQL migration with checksums/advisory locking, forced tenant RLS, composite tenant foreign keys, indexes and non-owner runtime grants.
- Added Argon2id credentials, signed random HttpOnly sessions with stored hashes, CSRF/Origin checks, rate limits, session revocation, scoped factory/department note commands and transactional audit.
- Added Main Admin provisioning and last-active-admin protection. No employee invitation/MFA/recovery flow is claimed.
- Added separate live workspace with TanStack Query, preserved sample dashboard and normalized source formatting for maintainability.
- Added local Docker and GitHub CI source, including real PostgreSQL/browser checks. They have not been executed in Docker or GitHub Actions locally.
- Development dependency minimatch is overridden to patched 11.0.8; lint/types/tests/build checks verify current usage. Dependency advisory evidence is not a full security audit.

### Verification evidence

- Real PostgreSQL 18.6 test cluster created with random credentials, a non-superuser migration owner and a distinct non-owner runtime. No production database is used.
- 12 PostgreSQL integration scenarios passed, including migration rerun, forced owner/runtime RLS, missing-context denial, connection reuse after commit/rollback, cross-tenant SELECT/INSERT/UPDATE/DELETE and foreign references, exact factory/department combinations, unassigned employees, CSRF, login rate limits, audit/rollback, last-admin protection and disabled-member denial.
- The browser scenario passed on desktop 1440x1000 and mobile 390x844: Main Admin login, scoped note persistence, HttpOnly cookie, empty localStorage, reload/logout, employee role-specific scope choices, account disable and old-data removal, and preserved sample filter behavior. No page errors or mobile horizontal overflow were observed.
- Desktop/mobile screenshots were inspected and remain under ignored .local/qa. Synthetic screenshot records are not marketplace media or factory UAT.
- Test shutdown uses pg_ctl and waits for a graceful stop; the final integration run completed with exit code 0.
- Final npm run verify passed: formatting, ESLint, API/web strict TypeScript (including tests/scripts), 5 unit tests, 12 real PostgreSQL/browser integration scenarios and both production builds. Final npm audit reported 0 vulnerabilities.

### Limits and next slice

Phase 0 decisions are provisional. Phase 1 is not complete: Main Admin MFA and auditable recovery, employee invitation/password setup, role-assignment management, legal entities/full business permissions, dedicated licensed/SaaS deployment rehearsals, controlled upgrades/restore and actual factory UAT remain pending. Session expiry is fixed at eight hours; no refresh-token mechanism is implemented. Expired-session maintenance and distributed login throttling are not implemented.

Only fresh migration and unchanged migration rerun were exercised; a prior populated SQL-version upgrade has not been rehearsed. Docker binaries are unavailable here, so images/Compose are prepared source only. The shared tenant engine is tested with both deployment-mode labels; a dedicated licensed deployment has not been rehearsed. Manufacturing quantities, stock ledger and shipment commands are not implemented. There is no public deployment, Vibe96 audit/submission/approval or sales claim.
