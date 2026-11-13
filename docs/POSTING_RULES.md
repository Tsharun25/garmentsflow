# Posting rules for future business slices

These rules are design requirements, not implemented stock features.

- Pieces: integers. Material quantities and money: PostgreSQL numeric with explicit precision and decimal-safe application arithmetic. Confirm precision, rounding, conversion versions and tolerances with the pilot before schema implementation.
- Every business command authorizes actor/membership/action/tenant/factory and checks the source version/state in one transaction.
- Claim a tenant-scoped idempotency key + payload fingerprint; same-key matching retry returns the prior authorized result, conflicting payload rejects. Unique source action prevents duplicate posting under another key.
- Lock balances and source records in stable order or use atomic conditional updates. Consume reservations atomically and reject negative availability, excess handover receipt and over-allocation of accepted output.
- Append immutable ledger/stage events, balance projections, state, audit and outbox together. Publish side effects after commit only.
- Posted records use linked reversal with actor, reason and dependency checks; do not overwrite balances or destroy history.
- Transfers must use explicit approved direct or in-transit rules. Cartons must have at most one active shipment allocation. Shipments remain allocated to logical PO lines while production stays pinned to approved revisions.
- Reconcile projections to source events and surface differences. Test final-piece races, duplicate shipment retries, rollback, stale versions, partial receipts and downstream-consumption reversal rejection.

The implemented factory-note slice only demonstrates transaction + audit + tenant/factory authorization. It does not implement a quantity ledger, idempotent stock commands or production posting.
