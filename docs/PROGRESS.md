# Progress against the new guide

## Phase 0 - provisional documents drafted

Workflow maps: DISCOVERY.md. ERD: ERD.md. Posting rules: POSTING_RULES.md. Permission matrix: PERMISSIONS.md. Pilot forms, actual tolerances, owners and approvals have not been supplied. Phase 0 operator acceptance is pending.

## Phase 1 - first vertical slice, in progress

Implemented PostgreSQL migrations/checksums/advisory lock, least-privilege runtime grants, forced tenant RLS, composite tenant references, explicit tenant transaction context, signed opaque HttpOnly sessions with stored token hashes, Argon2id passwords, Origin/CSRF checks, login rate limits, Main Admin provisioning, scoped factory/department note UI/API, append-only note/audit insertion, immediate disabled-membership rejection and last-admin protection.

Preserved the existing fictional dashboard, its filters, detail dialog and CSV export. It is not connected to live manufacturing records. Real workspace is a separate button/route.

Prepared local Docker and CI source. Runtime reads only DATABASE_URL; migrations/provisioning use MIGRATION_DATABASE_URL. No MongoDB records have been read, written or deleted. Baseline rollback and data-preservation limits are in decisions/001-postgresql-migration.md.

## Remaining Phase 1 exit gates

- Main Admin MFA and auditable recovery.
- Named employee invitation/password setup and role-assignment management UI/commands.
- Legal entity model and comprehensive resource/action permission catalogue.
- Dedicated licensed deployment rehearsal, SaaS rehearsal, Docker runtime verification and backup/restore.
- Real factory approvals and UAT.

Do not mark all Phase 1 complete or advertise production readiness. The next implementation slice is admin MFA + employee invitation/scoped assignment, with real PostgreSQL and browser allow/deny tests.

## Verification

The real PostgreSQL/browser integration suite passed 12 scenarios, including desktop/mobile operator access and disabled-session rejection. Details are recorded in IMPLEMENTATION_REPORT.md. Unexecuted CI, Docker or browser steps must remain marked unverified. No Vibe96 submission, live demo, audit score or sales claim is implied.
