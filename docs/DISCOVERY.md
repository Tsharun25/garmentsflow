# Phase 0 discovery: provisional design

No factory pilot has supplied forms, staff approvals or real records. The following is a synthetic starting point, not operator acceptance.

## Woven route (provisional)

Buyer PO/revision -> BOM approval -> factory production allocation -> material readiness/roll reservation -> Store receipt/QC -> fabric issue -> Cutting bundles -> Sewing receipt/output -> Finishing -> Quality release -> Packing cartons -> Commercial partial shipment -> PO balance reconciliation.

## Knit route (provisional)

Buyer PO/revision -> BOM approval (GSM, shade/dye lot, width, units provisional) -> production allocation -> accepted fabric lot/roll receipt -> reservation/issue -> Cutting -> Sewing -> Finishing/Quality -> Packing -> Commercial partial shipment. Upstream knitting/dyeing manufacture and Sweater are outside the first operational release.

## Handover ownership and authority

| Source -> receiver                   | Approval owner (unconfirmed)       | Quantity / authority                                      | Correction path                                                        |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Merchandising -> Planning            | Merchandising head                 | Approved PO/BOM revision, integer pieces                  | New revision; existing production remains pinned until approved replan |
| Planning -> Store/Cutting            | Planning head                      | Approved factory/line allocation and material requirement | Schedule revision; flag reservations for review                        |
| Store -> Cutting                     | Store head                         | Posted issue, exact base-unit quantities, lot/roll        | Linked return/reversal only if downstream dependencies allow           |
| Cutting -> Sewing                    | Cutting head / Sewing receiver     | Offered bundles, accepted/partial/disputed receipt        | Source department corrects offer; receiver records discrepancy         |
| Sewing -> Quality/Packing            | Sewing head / Quality              | Stage events and accepted pieces                          | Traceable rework/reject/reversal                                       |
| Packing -> Commercial                | Packing head / Commercial receiver | Approved carton contents and available accepted output    | Packing correction request; retain finalized versions                  |
| Commercial -> buyer shipment balance | Commercial head                    | Posted shipment allocations to logical PO lines           | Approved amendment/credit/reversal per pilot rules                     |

Every boundary carries tenant, legal entity/factory where applicable, source reference, actor, timestamp, remaining quantity and explicit receiver. Tenant is authenticated context, not browser proof. A receiver never edits the source department's original record.

## Factory decisions still needed

- Pilot approval owners, named staff/backup admins, legal entities, factory/warehouse boundaries.
- Procurement PO ownership and supplier receipt references.
- Actual Woven/Knit route, optional quality/finishing stages, mandatory GSM/width/shade/dye lot/roll fields.
- Packing mixes, carton label uniqueness scope, PO number scope and shipment/overproduction tolerances.
- Unit precision, conversion/rounding rules and mass-to-length measurement authority.
- Direct vs in-transit transfers, maker/checker rules and post-finalization corrections.
- Sample PO/BOM/stock forms, realistic tenant/user/data volumes, peak load and response-time goals.
- RPO/RTO, offline requirements, admin MFA/recovery, support authorization and licence/export terms.

No provisional rule is represented as pilot-approved.
