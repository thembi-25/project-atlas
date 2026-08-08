# Suppliers — PRD

## 1. Purpose

Maintain a basic record of the vendors an Organization purchases parts from and track manual purchase orders. See [Suppliers](../03-domain/suppliers.md).

## 2. Business problem

Businesses currently track supplier relationships and purchase history informally (memory, paper receipts), making it hard to answer "what did we spend with this supplier this year" or "who do we usually buy this part from."

## 3. Goals

- A simple, reliable Supplier directory per Organization.
- Basic manual Purchase Order tracking (what was ordered, from whom, received or not).

## 4. Non-goals

- Live catalogs, automated ordering, or pricing integration — explicitly Phase 4 (Marketplace) scope, not built here. See [Marketplace PRD](./marketplace-prd.md).

## 5. Personas

[Denise (Dispatcher)](../00-overview/user-personas.md)/[Maria (Owner)](../00-overview/user-personas.md).

## 6. User stories

As an Owner, I want to record which supplier we use for a given part category, so new staff know where to order from. As a Dispatcher, I want to log a purchase order so we know what's on the way.

## 7. Functional requirements

CRUD for Suppliers; basic Purchase Order creation (line items, status, received date) referencing Inventory Items.

## 8. Business rules

Full detail in [Suppliers](../03-domain/suppliers.md) — notably: launch scope is informational/manual only; automated ordering is explicitly deferred to Phase 4.

## 9. State machines

Purchase Order status: `draft → ordered → received` (+ `cancelled`) — a simple linear lifecycle, not a complex workflow.

## 10. Data requirements

`suppliers`, `purchase_orders` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH/DELETE /api/v1/suppliers`, `GET/POST/PATCH /api/v1/purchase-orders`.

## 12. Permission requirements

Dispatcher/Admin/Owner: full management. Technician: read-only.

## 13. UI requirements

Supplier list/detail page; simple Purchase Order list with status; "receive" action that creates corresponding `stock_movements` entries (see [Inventory PRD](./inventory-prd.md)).

## 14. Notifications

None at launch (Purchase Order status changes are visible in-app; automated supplier-facing notifications are Phase 4 scope).

## 15. Audit requirements

Supplier and Purchase Order create/update/delete produce [Audit Events](../03-domain/audit-events.md).

## 16. Error cases

Marking a Purchase Order received with mismatched line-item quantities (`422`, requires explicit partial-receipt handling rather than silently accepting a mismatch).

## 17. Edge cases

A Purchase Order is partially received (some line items in, others backordered) — modeled as a partial-receipt action that updates only the received line items' `stock_movements`, leaving the PO in an `ordered` (partially fulfilled) state until fully received.

## 18. Acceptance criteria

**Given** a Purchase Order marked fully received, **when** staff check Inventory, **then** each ordered Inventory Item's quantity on hand reflects the received amount via a corresponding `stock_movements` row.

## 19. Testing requirements

Integration tests for PO receive-triggers-stock-movement; partial-receipt handling tests.

## 20. Future extensions

Live Supplier catalogs, pricing, and in-workflow ordering — see [Marketplace PRD](./marketplace-prd.md) and [Roadmap Phase 4](../13-roadmap/phase-4-marketplace.md).
