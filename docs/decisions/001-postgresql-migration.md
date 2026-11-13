# ADR 001: PostgreSQL transition

Accepted by owner instruction to follow the new guide, 2026-11-13.

Baseline: Git commit 1714a27442f51c13086223920d94ece07742e317. Existing MongoDB code only connected for health; no Mongoose business models, seed/import tools or persistence endpoints exist. No configured database contents have been inspected. Do not assume any external MongoDB database is empty or delete it.

Plan: preserve the working fictional dashboard, add versioned PostgreSQL SQL migrations and a scoped identity/factory-note vertical slice. Do not read or write MongoDB data. New PostgreSQL database must be separate. Schema migration commands require a migration-role connection; runtime uses a non-owner, non-BYPASSRLS role. Test actual PostgreSQL role isolation.

Rollback: stop the new application, restore application source to the baseline in a separate checkout, reinstall its locked dependencies and point it at the original MongoDB configuration. PostgreSQL-created records cannot be represented by the old dashboard: export and preserve the new database before any cutover; never silently discard new records. No destructive down migration is provided. Rehearse backup/restore before a production upgrade.

If business data exists outside this repository, inventory it and design a separately approved import/reconciliation before cutover. No factory data migration is performed in this change.
