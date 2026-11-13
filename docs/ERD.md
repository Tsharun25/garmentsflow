# Data model

Only identity, factory scope, sessions, development work notes and audit are implemented. Manufacturing records below are planned logical relationships.

```mermaid
erDiagram
  tenants ||--o{ factories : owns
  tenants ||--o{ memberships : authorizes
  memberships ||--o{ role_assignments : holds
  factories ||--o{ role_assignments : scopes
  memberships ||--o{ sessions : authenticates
  factories ||--o{ factory_notes : queues
  memberships ||--o{ factory_notes : authors
  memberships ||--o{ audit_events : acts
  buyer_orders ||--o{ buyer_order_revisions : revises
  buyer_orders ||--o{ buyer_order_lines : identifies
  buyer_order_lines ||--o{ buyer_order_line_revisions : revises
  buyer_order_revisions ||--o{ bom_revisions : approves
  bom_revisions ||--o{ bom_items : contains
  buyer_order_line_revisions ||--o{ production_orders : pins
  production_orders ||--o{ schedule_revisions : plans
  production_orders ||--o{ route_revisions : follows
  materials ||--o{ material_lots : traces
  material_lots ||--o{ stock_movements : records
  production_orders ||--o{ bundles : produces
  bundles ||--o{ stage_events : progresses
  stage_events ||--o{ handovers : offers
  handovers ||--o{ handover_receipts : accepts
  cartons ||--o{ carton_items : packs
  shipments ||--o{ shipment_allocations : posts
  buyer_order_lines ||--o{ shipment_allocations : reconciles
```

Implemented tenant-owned tables have non-null tenant IDs, composite primary/foreign keys, ENABLE + FORCE RLS and tenant-local transaction context. The runtime has no table ownership/BYPASSRLS and no DDL rights. `tenants` is a root directory inaccessible directly to the runtime; a fixed-search-path SECURITY DEFINER function resolves a slug for password authentication. A selected slug grants no business access by itself. A signed random cookie is verified before selecting a tenant for session lookup, then the stored hash, expiry and active membership are checked.

Current membership rows combine account credentials and tenant membership for this bounded slice; global multi-business identities, legal entities and invitations are not implemented. IDs and actor references remain immutable. Password hashes are never returned to the UI. Sessions expire after eight hours and are revoked on logout/disable. Notes and audit retain history; no user-delete endpoint exists. Retention and account recovery policy remain open decisions.
