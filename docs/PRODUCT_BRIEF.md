# GarmentsFlow ERP · Codex build guide

**Product scope:** Woven and Knit garment manufacturing

**Deployment:** Single-business licensed installation and multi-tenant SaaS

**Status:** Build specification and release criteria. Pilot assumptions require validation before commercial release.

## 1. Instructions to Codex

Use this guide as the product brief. Read the repository's instructions, inspect its current implementation and identify the first unfinished milestone. For a new repository, start with Phase 0 and deliver the Phase 1 foundation. For an existing repository, preserve working features and data. If it already uses MongoDB, document the migration and rollback options before changing databases or touching stored data.

Implement one working vertical slice at a time through the database, API, UI and tests. Keep a progress record with implemented scope, commands run, test results, migration status and open factory decisions. Use synthetic seed data for development. Ask for input when a decision materially changes factory records, contractual commitments or release safety. Continue independent work while that decision is pending. A phase is complete when its exit criteria have evidence. Mark any blocked or untested criteria explicitly.

## 2. Product and release scope

GarmentsFlow supports Buyer PO to shipment with seven primary department workspaces: Merchandising, Planning, Commercial, Store, Cutting, Sewing and Packing. Include finishing and quality checkpoints in the production route according to the factory. Procurement must cover the material purchasing and receipt references required by the pilot. Assign purchase order ownership to the actual buyer or procurement role at that factory.

The initial product covers operational manufacturing and basic Commercial tracking. Full general ledger, payroll, advanced costing and stock valuation, direct bank/customs integrations, upstream textile manufacturing and Sweater production are follow-on decisions. If a paying pilot requires any of these, record the specific deliverables and integration boundaries before committing to that rollout. The core data model must support future process routes and material attributes, including yarn lot, gauge and linking for Sweater.

Success means a real Woven order and a real Knit order can be processed and reconciled by factory staff under their own accounts, with recoverable data and predictable operations. Keep commercial claims tied to demonstrated scenarios and measured outcomes.

## 3. Architecture and stack

| Area     | Default                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web      | React, TypeScript, Vite, Tailwind CSS, TanStack Query. Accessible forms, keyboard-first grids, reliable validation and actionable errors.                                                                           |
| API      | Node.js LTS, Express, TypeScript, Zod, versioned REST and OpenAPI. Use explicit commands for approval, posting, receiving and reversal.                                                                             |
| Database | PostgreSQL, node-postgres and a typed SQL query builder such as Kysely. Versioned SQL migrations own constraints, indexes and RLS. PostgreSQL is the recommended change from the initial MongoDB/Mongoose proposal. |
| Jobs     | PostgreSQL outbox for durable dispatch. Add Redis/BullMQ when asynchronous imports, exports or integrations justify a queue. Workers consume jobs idempotently.                                                     |
| Files    | Private object storage or an equivalent private filesystem adapter for licensed deployments. Store metadata and authorization scope in PostgreSQL.                                                                  |
| Deploy   | Docker images with pinned versions, environment-specific configuration and secrets outside the repository.                                                                                                          |

Start with a modular monolith and one transaction boundary per business command. Keep identity/tenancy, master data, merchandising, planning, purchasing, inventory, production, quality, packing, commercial, reporting and licensing as modules. Keep HTTP and UI concerns outside business commands. Route imports and jobs through the same commands as the UI. Provide shared API contracts without sharing database internals with the frontend.

Suggested repository layout for a new repo:

```text
apps/web
apps/api
apps/worker          # Add when needed
packages/contracts
db/migrations
docs                 # Decisions, UAT evidence and runbooks
```

Maintain one codebase, release artifact and migration history. A licensed install provisions a single tenant with a dedicated database. SaaS starts with a shared database and tenant-scoped rows, with a dedicated database deployment option when a customer contract warrants it. Establish expected tenant count, users and data volumes before sizing. Keep database routing and licensing behind platform interfaces. Business workflows use the same rules across deployment modes.

## 4. Identity, tenant boundaries and permissions

- **Tenant** is a customer business. A tenant can have legal entities, factories, production lines and warehouses. Store which factory and entity own each scoped resource. A company-wide Buyer PO can be allocated to specific factories through authorized production orders.
- **Customer Main Admin** is provisioned at onboarding. The role can access and manage all customer modules, factories, employees and reports within that tenant. Support named backup admins if needed and protect the last active Main Admin from removal. Require MFA for admins and auditable account recovery. Maintain separate SaaS platform operator identities. Any support access to business data requires explicit, time-limited authorization and audit.
- Main Admin creates or invites named employee accounts, assigns scoped roles and can disable memberships. Users set their own passwords through an invite or identity provider. Revoke sessions or immediately reject requests from disabled memberships. Retain historical actor references.
- Represent role assignments as the combination of membership, role and scope. A Store role for Factory A and a Planning role for Factory B grant only those respective combinations. Department identifies where an employee works. Role and scope determine access. New employees receive business access only after assignment.
- Authorize the actor, current membership, action and target tenant/factory at the server. Apply authorization to lookup endpoints, reports, export creation and download, attachments, jobs and bulk imports. Reset frontend query state when switching tenant/factory. Make object storage private and issue short-lived links after access checks.
- Require distinct permissions for view, create, edit draft, submit, approve, post, receive, reverse and export wherever applicable. Main Admin uses the same workflows and business invariants. Where maker/checker separation is enabled, enforce it by actor identity even for admins. Audit role changes and privileged actions.

### Initial department role templates

Staff draft and record their own department's work. Department heads approve, post or request correction where assigned. Grant sensitive reversals and bulk exports explicitly. Factory scope applies throughout.

| Department                     | Own writes                                                                                            | Permitted cross-department views and handovers                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Merchandising                  | Buyer PO, amendments, style, BOM, sample and approvals                                                | Read approved production and shipment status, shipped quantity and PO balance. Commercial invoice writes remain Commercial permissions. |
| Planning                       | Capacity calendar, line allocation, priority, schedule revisions                                      | Read approved PO, material readiness and production actuals. Publish approved schedules to assigned departments.                        |
| Store                          | Material receipt, QC disposition references, reservation, issue, return, transfer and adjustments     | Read approved material demand and issue requests. Provide issue/lot/quantity to Cutting.                                                |
| Cutting                        | Cut plan, lays if used, actual cut and reject, bundles and handover                                   | Read assigned plan, BOM requirements and material issue data. Send bundles to Sewing.                                                   |
| Sewing                         | Bundle receipt, line input/output, WIP, defects, rework and handover                                  | Read assigned plan and offered bundles. Record receipt and report discrepancies in its own records.                                     |
| Packing                        | Packing instruction application, carton contents, labels and handover                                 | Read accepted finishing/quality quantities. Offer eligible cartons to Commercial.                                                       |
| Commercial                     | Import/export document tracking, booking, commercial invoice, final packing list and shipment posting | Read eligible carton details. Raise correction requests to Packing. Publish approved shipment status and balance.                       |
| Finishing/Quality when enabled | Finishing output, inspection, hold, reject, rework and release                                        | Read relevant production and lot references. Release accepted pieces or cartons to the next stage.                                      |

For implementation, derive a route-level authorization matrix with resource, action, role, scope, field visibility and expected allow/deny behavior. Grant cross-department visibility through purpose-built views of approved data. A receiver writes its own receipt or discrepancy record. A source department controls correction of its source records.

## 5. Factory workflows and handover

1. **Merchandising** imports or records the buyer order, style and color/size/delivery lines. Approve the PO and BOM revision. Amendments retain historical quantities and flag downstream plans and reservations for review. Existing production orders retain their approved references until formally replanned.
2. **Planning** allocates quantities across factories, lines and dates using shift calendars and capacity. Track material readiness and pre-production milestones alongside dates. Show plan versus actual, conflicts and affected orders before publishing a revision. Make warnings and hard limits explicit by rule.
3. **Store and purchasing** turn material demand into reservations or purchase requirements. Receive against supplier documents and purchase lines where applicable. Track accepted, held and rejected stock. Issue approved quantities by location and lot/roll, receive returns and account for transfers and adjustments.
4. **Cutting and Sewing** track cut quantities, bundle split/merge lineage when used, sewing receipt, input/output, rejects and rework. Confirm quantities at each handover. Finishing and Quality inspect and release accepted pieces where the route requires them. Use approved route versions with explicit permitted transitions.
5. **Packing** creates cartons with color/size quantities under buyer packing instructions. Labels identify cartons uniquely. Support mixed cartons where buyer rules permit. Validate contents against accepted available output. Offer eligible cartons to Commercial.
6. **Commercial** can track bookings and relevant import/export documents before Packing. Generate final packing lists and invoice data from a specific shipment revision and approved carton contents. Record shipment in partial lots, update Buyer PO balances and preserve finalized document versions. Confirm required documents and tolerances with the pilot. Obtain separately scoped requirements for statutory formats or live integrations.

Use a consistent lifecycle where applicable: draft → submitted → approved → posted, with rejection/cancellation before posting and linked reversal after posting. Represent handovers separately as offered, partially received, received or disputed. Enforce remaining quantity and recipient scope on every receipt. Test whether dispatched stock is in transit or immediately available at the destination according to the approved business workflow. Distinguish reversible internal events from externally finalized shipment documents. Record corrections to finalized documents through an approved amendment or credit/reversal procedure appropriate to the pilot.

## 6. Database design

These are logical tables to refine into an ERD and migrations. Identify ownership, nullability, lifecycle and retention for each.

| Domain      | Core records and relationships                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Identity    | tenants, legal_entities, factories, users, memberships, roles, permissions, role_assignments, sessions, audit_events                  |
| Master data | buyers, suppliers, styles, style_variants, materials, units, warehouses, locations, lines, calendars                                  |
| Orders      | buyer_orders, buyer_order_revisions, buyer_order_lines, buyer_order_line_revisions, bom_revisions, bom_items                          |
| Planning    | production_orders, production_order_allocations, route_revisions, route_steps, schedule_revisions, line_allocations, milestones       |
| Inventory   | purchase_orders/lines, receipts/lines, material_lots, rolls, reservations, inventory_documents/lines, stock_movements, stock_balances |
| Production  | cut_runs, bundles, bundle_lineage, stage_events, handovers, handover_lines, handover_receipts, inspection_results, rework_events      |
| Shipment    | packing_instructions, cartons, carton_items, shipments, shipment_cartons, shipment_allocations, commercial_document_revisions         |
| Reliability | idempotency_records, outbox_events, import_batches, file_objects, entitlements                                                        |

### Constraints and representations

- Put non-null tenant IDs on tenant-owned rows. Use composite foreign keys such as `(tenant_id, buyer_order_line_id)` referencing a unique `(tenant_id, id)`. Include factory or other parent scope where a relationship must stay in that scope. Model cross-factory transfers explicitly.
- Enable and force Row-Level Security on tenant-owned tables. Use an explicit transaction-local tenant context on the same pooled connection for all scoped queries. Policies fail closed when context is missing. The application/worker role has neither ownership nor bypass privileges. Use a separate migration role. Treat RLS as defense in depth alongside server authorization. Test SELECT, INSERT, UPDATE and DELETE, connection reuse and maintenance roles.
- Use tenant-scoped unique business keys with explicit dimensions. For example, PO number scope may include buyer, and a carton identifier must resolve to one carton within its agreed label scope. Keep stable line IDs across revisions, with production pinned to the approved revision and shipments allocated to the logical PO line.
- Store pieces as integers. Use exact PostgreSQL numeric types and decimal-safe application arithmetic for material quantities, conversions and money. Document precision and rounding. Keep entered quantity/unit and base quantity/unit. Preserve the applied conversion rule on posting. Use material/lot measurements for mass-to-length conversions when required.
- Record UTC instants and separate local business date/shift where operationally meaningful. Persist actor, source document and correlation references. Use foreign keys and typed references for records that affect quantities. Reserve JSONB for bounded attributes and snapshots, with validation and a migration strategy.
- For Woven and Knit, confirm pilot-specific fabric width, shade, GSM, dye lot and roll fields and which are mandatory. Version route definitions and BOM revisions. Keep indexes aligned with tenant/factory, business status and actual reporting filters. Avoid tenant-wide unbounded result sets.

### Posting and concurrency

For every stock, WIP or shipment command, perform the following in one database transaction:

1. Verify authorization, current document state and version. Claim a tenant-scoped idempotency key for the command with a payload fingerprint. Return the previous result on a matching authorized retry and reject key reuse with different input.
2. Lock the source records and affected balance rows in a consistent order or use atomic conditional updates. Guard available stock and remaining eligible quantities. Define on-hand, held, reserved and available quantities clearly. Posting against a reservation consumes it atomically. Enforce limits when concurrent commands affect the same balance, handover, carton or PO line.
3. Insert immutable ledger/events, update balance projections and document state, and write audit plus any outbox event. Use a unique source event reference so the same document action cannot be posted twice under different keys. Use bounded retries for retryable transaction failures.
4. Commit before responding or dispatching side effects. Worker retries must preserve the same business result. Reconcile balance projections to the ledger and surface discrepancies for investigation.

Use linked reversal entries with reason, actor and timestamp. Validate dependencies before reversal so downstream consumption cannot become inconsistent. For a two-step transfer, represent dispatch into an in-transit location and destination receipt as separate atomic postings. For direct transfers, post both sides together. A carton can be on only one active shipment allocation at a time. Validate quantity tolerances against previously posted shipments plus the current allocation.

## 7. Ease of use, imports and reporting

- Give each department a work queue for its pending tasks and exceptions. Support search by buyer PO, style, lot/roll, bundle, carton and shipment. Expose permitted source and destination references so users can trace handovers.
- Provide color/size grids, keyboard entry, barcode-friendly fields and clear quantity/units. Preserve draft input on recoverable errors. For weak connections, show whether a command committed and use safe retries. Confirm offline write requirements with pilots before designing synchronization.
- Build Excel import with templates, preview, row-level errors, explicit duplicate policy and confirmation. Record source file, import actor and row outcomes. For large files, use retry-safe batches with clear partial-success semantics. Opening stock is a controlled ledger posting and requires count reconciliation.
- Initial reports include order status and shipment balance, line plan versus actual, material shortage, stock by location/lot, WIP and rejects, carton/shipment list, and audit history. Reconcile totals to source records and apply scope on screen and export. Consider Bangla UI labels where operators need them, using locale-ready strings from the start.

## 8. Operations and licensing

- Use TLS, secure session handling, CSRF protection where cookie authentication applies, rate limits, least-privilege service roles and safe secret rotation. Protect uploads with file type/size controls and a quarantine/scan workflow where required. Exclude passwords, tokens and sensitive document content from logs.
- Provide structured logs, correlation IDs, error metrics, queue lag, DB health, storage and backup monitoring. Run schema migrations as controlled release steps. Prefer expand/migrate/contract changes, validate upgrades with realistic data and define a rollback or forward-fix procedure before deploying.
- Encrypt and test backups for database and files. Agree on RPO (acceptable data loss) and RTO (acceptable downtime) with the pilot, then measure recovery against them. For shared SaaS, prove tenant-level recovery using an isolated restore, consistent related records and a controlled re-import. Exercise a full licensed-install restore separately.
- Track SaaS subscriptions and licensed installation entitlements separately from employee permissions. If offline licensing is required, use locally verifiable signed entitlements and define the renewal/grace workflow. Confirm expiry and export terms before launch. Preserve business records and a documented access/export path during entitlement changes. Define who owns backups, updates and support for each deployment model.

## 9. Build sequence and verification

| Phase                       | Working deliverable                                                                                      | Exit evidence                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 · Discovery               | One Woven and one Knit workflow map, sample forms and data, ERD, posting rules, permission matrix        | Document the approval owner, factory scope, quantities, tolerances, correction path and authoritative record for each handover. Record open decisions and scope.                                |
| 1 · Foundation              | Repository, local Docker, CI, migrations, login, provisioning, Main Admin, scoped role assignment, audit | Fresh install works. Two synthetic tenants and two factories prove both cross-tenant and cross-factory denial. Disabling a membership denies access.                                            |
| 2 · PO to stock issue       | Buyer PO/BOM revision, line plan, material readiness, Store receive/reserve/issue/return/transfer        | Excel import and quantities reconcile. Simultaneous issues and duplicate retries preserve balances. Test reversal, stale edits and failure rollback.                                            |
| 3 · Stock issue to shipment | Cutting, Sewing, quality/finishing, Packing and Commercial with partial shipment                         | Trace from lot/roll and issue through relevant bundle and carton links to shipment and back. Verify rework, partial receipt, carton conflicts, buyer PO amendment and partial shipment balance. |
| 4 · Operational pilot       | Woven and Knit pilot, licensed deployment and SaaS rehearsal                                             | Actual operator UAT, reconciliation, access checks, upgrade and restore drills, monitored load test and signed pilot results.                                                                   |

Run CI with formatting/lint, typecheck, build, unit and real PostgreSQL integration tests. Add browser end-to-end tests for role-based workflows and release smoke tests. Test duplicate shipment retries, race conditions on the last available stock/pieces, cross-tenant record IDs, scoped exports/files, missing tenant context, partial import failure, and job retry after a commit. Test that failed commands leave a consistent ledger, balance and document state. Run migration checks against both empty and prior-version databases.

Before charging for a production rollout, document the tested workload, environment and measured performance. Agree on acceptable response times for common screens and commands and the expected peak workload with the pilot. Require successful recovery drills, reconciled source totals, operator acceptance and no known release-blocking data integrity or access-control defects. Provide setup, upgrade, restore, support and incident runbooks to the people responsible for the installation.

## 10. Competitive benchmarks and pilot scorecard

These benchmarks reflect public vendor descriptions. Use the corresponding scenarios in a hands-on demo or pilot to measure performance and usability.

| Public reference                        | GarmentsFlow evaluation scenario                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datatex NOW production and lot tracking | Given a fabric lot or carton, trace related material movement, production and shipment. Measure lookup time and verify every displayed quantity against source records.       |
| BlueCherry ERP and Shop Floor Control   | Have operators record bundle receipt, output, rejects and rework, then compare shift totals across roles. Measure entry time, corrections and reconciliation effort.          |
| FastReactPlan by Coats Digital          | Change delivery date or line capacity while material is late. Time how quickly a planner finds affected orders, revises a plan and publishes it with the old revision intact. |

Add tasks for importing a representative buyer PO spreadsheet, onboarding department staff, posting a partial shipment and producing the final packing list. Capture baseline time, manual steps, error count and completion without assistance using the factory's current workflow. Compare GarmentsFlow on the same dataset and operator tasks. Set target improvements with each pilot before testing. Market the demonstrated advantages for the target factories.

Sources:

- [Datatex NOW Production](https://datatex.com/portfolio-items/production/) and [Datatex Lot Tracking](https://datatex.com/lot-tracking/)
- [BlueCherry ERP](https://bluecherry.com/en/resources/product-sheet/bluecherry-erp) and [BlueCherry Shop Floor Control](https://bluecherry.com/en/resources/product-sheet/bluecherry-shop-floor-control-sfc)
- [Coats Digital FastReactPlan](https://www.coatsdigital.com/en/manufacturer/fastreactplan/)
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) and [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

## 11. Starter prompt

> Read GarmentsFlow-Codex-Guide.md and the repository instructions. Inspect the repository and report the first unfinished phase. For a new repo, draft the Phase 0 ERD, posting rules and permission matrix using the guide's defaults, marking factory-specific assumptions. Then implement the Phase 1 foundation where those decisions are sufficient. Verify both deployment modes and tenant/factory authorization with real database integration tests. Provide working local setup commands, a migration summary, test evidence and the next implementation task. Keep factory-specific rules provisional until confirmed with the pilot.
