# Delivery roadmap

Follow the supplied guide in reviewable phases. A screen alone is not completion evidence.

1. Foundation: workspace, frontend, API, database connection and health. Source implemented; real database verification remains pending.
2. Authentication: tenant registration, secure HttpOnly sessions, password hashing, CSRF protection, rotation/revocation and rate limits.
3. Tenant isolation and RBAC: derive tenant from verified session, backend permissions and cross-tenant read/write/delete/reference tests.
4. Buyers, suppliers and styles: validated tenant-scoped CRUD, pagination, indexes.
5. Orders and time/action milestones.
6. Material booking and inventory transaction ledger.
7. Samples, configurable woven/knit routing and production.
8. Quality inspections and reports.
9. Shipment, costing and commercial traceability.
10. Reports, notifications and audit history.
11. Single-business/SaaS deployment configuration and subscriptions. Confirm marketplace agreement before adding any licensing enforcement.
12. Security review, restore-tested backups, deployments, buyer documentation and release archive.

First sellable scope should be agreed and fully verified before listing. Do not advertise future modules as working features.
