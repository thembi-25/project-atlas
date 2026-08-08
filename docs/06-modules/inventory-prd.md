# Inventory — PRD

## 1. Purpose

Track parts/materials stock across warehouse and truck locations, and tie part consumption to Job costing. See [Inventory](../03-domain/inventory.md).

## 2. Business problem

Without inventory tracking, businesses either over-order (tying up cash in unused stock) or under-order (delaying jobs waiting on parts), and job profitability calculations are unreliable because parts cost isn't systematically captured per job.

## 3. Goals

- Accurate, always-current stock levels per location without manual physical counts.
- Every part used on a Job is captured with its cost at time of use, feeding accurate Job costing.
- Low-stock visibility before it becomes a blocked Job.

## 4. Non-goals

- Full warehouse management (bin-level location tracking, barcode-driven receiving workflows) — Atlas tracks quantity per location, not warehouse logistics at that granularity, for the target segment's scale.

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md) (consumes), [Denise (Dispatcher)](../00-overview/user-personas.md)/[Maria (Owner)](../00-overview/user-personas.md) (manage stock/reorder).

## 6. User stories

See [User Stories](../01-product/user-stories.md); plus: As an Owner, I want to see which parts are running low across all trucks, so I can reorder before a job gets delayed.

## 7. Functional requirements

CRUD for Inventory Items; per-location quantity tracking; consume-on-Job flow; manual stock adjustment/receiving; low-stock threshold alerting.

## 8. Business rules

Full detail in [Inventory](../03-domain/inventory.md) — notably: quantity on hand is always derived from `stock_movements`, never directly editable; consumption is a soft warning, not a hard block, if stock would go negative.

## 9. State machines

None — Inventory Items have no status state machine; stock levels are a continuously derived value.

## 10. Data requirements

`inventory_items`, `inventory_locations`, `stock_movements`, `job_parts` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH/DELETE /api/v1/inventory-items`, `POST /api/v1/inventory-items/{id}/adjust` (creates a `stock_movements` row), `POST /api/v1/jobs/{id}/parts` (consume on Job).

## 12. Permission requirements

Technician: consume parts on assigned Jobs (restricted to `job_parts` creation, not Inventory Item master data edits). Dispatcher/Admin/Owner: full management. Accountant: read-only (for costing).

## 13. UI requirements

Inventory Item list with per-location quantity columns; mobile "add part" search/autocomplete on the Job screen; low-stock dashboard widget.

## 14. Notifications

Low-stock alert to Dispatcher/Owner — see [Notifications PRD](./notifications-prd.md).

## 15. Audit requirements

Every `stock_movements` row is itself an append-only audit trail; in addition, Inventory Item master-data edits (cost/price changes) produce standard [Audit Events](../03-domain/audit-events.md).

## 16. Error cases

Consuming more quantity than is on hand at a location (allowed with a warning, per Business Rules — not an error, but the response includes a `warning` field); adjusting stock with a non-numeric or negative-for-a-`received`-type movement (`422`).

## 17. Edge cases

A part is consumed from a location other than the Technician's assigned truck (borrowed from another truck) — the consuming Technician selects the correct source location explicitly; the system does not assume truck = Technician's default location is always correct. A physical count doesn't match system quantity — reconciled via an `adjusted` stock movement with a required reason, not by silently resetting the quantity.

## 18. Acceptance criteria

**Given** an Inventory Item with 5 units at a truck location, **when** a Technician consumes 2 units on a Job, **then** the location's derived quantity on hand becomes 3, and the Job's cost reflects `2 × unit_cost_at_time`.

## 19. Testing requirements

Quantity-derivation-from-movements tests; negative-stock-warning (not block) tests; Job-costing-uses-cost-at-time-not-current-cost tests.

## 20. Future extensions

Automated reorder suggestions/Marketplace integration (Phase 4, [Marketplace PRD](./marketplace-prd.md)); barcode scanning for receiving and consumption.
