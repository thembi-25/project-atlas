# Marketplace — PRD

> **Status: Future phase (Strategic Phase 3).** This PRD documents the intended design for domain-model and roadmap completeness. It is not built at launch — see [Product Scope](../01-product/product-scope.md) and [Strategic Phase 3](../13-roadmap/phase-4-marketplace.md).

## 1. Purpose

Let Organizations order parts from connected Suppliers directly from within the Job/Inventory workflow, without leaving Atlas. See [Marketplace](../03-domain/marketplace.md).

## 2. Business problem

A Technician short a part today stops working, calls the office, who calls a supplier, who may or may not have same-day stock — a slow, manual chain that Marketplace collapses into an in-app reorder.

## 3. Goals (for the eventual build)

- Same-day part availability visibility from connected Suppliers.
- One-tap reorder from a Job's parts list.
- Transparent, line-item-visible commercial terms (see [Product Principles](../00-overview/product-principles.md), principle 9).

## 4. Non-goals

- Building Marketplace before Core Operations (Phase 2) has a proven, active Organization base — see [Product Strategy](../01-product/product-strategy.md).

## 5. Personas

Curtis (Technician, orders), Denise/Maria (approve), a future **Supplier Rep** persona (fulfills) — see [User Personas](../00-overview/user-personas.md), Future-phase personas.

## 6. User stories

As a Technician short a part, I want to see same-day availability from a connected Supplier and order it directly from the Job, so I don't have to stop working and call the office.

## 7. Functional requirements (planned)

Supplier catalog browsing/search mapped to `inventory_items` taxonomy; order placement from a Job context; order status tracking; automatic Inventory receipt on delivery confirmation.

## 8. Business rules (planned)

Full detail in [Marketplace](../03-domain/marketplace.md) — notably: order placement never blocks Job completion; listings map to existing Inventory taxonomy rather than a parallel product model.

## 9. State machines (planned)

Marketplace Order: `placed → confirmed → shipped → delivered` (+ `cancelled`).

## 10. Data requirements (planned)

`marketplace_listings`, `marketplace_orders`, `supplier_connections` — see [Marketplace](../03-domain/marketplace.md).

## 11. API requirements (planned)

`GET /api/v1/marketplace/listings`, `POST /api/v1/marketplace/orders`, `GET /api/v1/marketplace/orders/{id}`.

## 12. Permission requirements (planned)

Same Role pattern as [Inventory](./inventory-prd.md) — Technician can place orders on assigned Jobs; Dispatcher/Admin/Owner approve/manage.

## 13. UI requirements (planned)

In-Job "order this part" flow surfaced when a needed Inventory Item is out of stock.

## 14. Notifications (planned)

Order confirmed/shipped/delivered status updates to the ordering staff.

## 15. Audit requirements (planned)

Every order placement and status change produces an [Audit Event](../03-domain/audit-events.md).

## 16. Error cases (planned)

Supplier connection unavailable/expired credentials at order time (`503`-equivalent with a clear retry/reconnect prompt).

## 17. Edge cases (planned)

An ordered part arrives short/damaged — reconciled via a partial-receipt flow analogous to [Suppliers PRD](./suppliers-prd.md#17-edge-cases).

## 18. Acceptance criteria (planned)

**Given** a connected Supplier with same-day stock, **when** a Technician places an order from a Job, **then** the order is visible to Dispatch within seconds and does not alter the Job's own status/completion path.

## 19. Testing requirements (planned)

Standard integration/E2E coverage once implementation begins, plus specific tests that order placement never blocks or delays Job state transitions.

## 20. Future extensions

Multi-Supplier price comparison at order time; take-rate/commercial-terms transparency reporting for Organizations; Supplier-side fulfillment dashboard.
