# Phase 4: Supplier Marketplace

## Goal

Let Organizations order parts from connected Suppliers directly inside the Job/Inventory workflow. See [Vision](../00-overview/vision.md), pillar 3, and [Marketplace PRD](../06-modules/marketplace-prd.md).

## Scope

- Supplier partnership development (business/commercial work, outside this documentation's scope, but a hard prerequisite).
- `marketplace_listings`, `supplier_connections`, `marketplace_orders` — see [Marketplace](../03-domain/marketplace.md), built as an extension of the existing `inventory_items` taxonomy per [ADR-025](../11-adr/ADR-025-marketplace-architecture.md).
- In-Job "order this part" flow for Technicians when Inventory is short.
- Order status tracking and automatic Inventory receipt on delivery.

## Dependencies

Requires [Phase 2: Core Operations](./phase-2-core-operations.md) complete, specifically a mature, well-used [Inventory](../03-domain/inventory.md) module — Marketplace listings map directly onto `inventory_items`, so that taxonomy must already be in real, validated use. Also requires a commercially credible base of active Organizations (see [Product Strategy](../01-product/product-strategy.md)) before Supplier partnerships are viable to negotiate.

## Exit criteria

- At least one Supplier partnership live with real catalog/ordering integration.
- Order placement demonstrated to never block or delay Job completion (see [Marketplace PRD](../06-modules/marketplace-prd.md), Acceptance Criteria).
- Take-rate/commercial terms transparent to Organizations at the line-item level, per [Product Principles](../00-overview/product-principles.md), principle 9.

## Explicitly out of scope for this phase

Multi-Supplier price comparison, Supplier-side fulfillment dashboards — see [Marketplace PRD](../06-modules/marketplace-prd.md), Future Extensions.

## Related documents

[Marketplace PRD](../06-modules/marketplace-prd.md) · [Marketplace](../03-domain/marketplace.md) · [ADR-025](../11-adr/ADR-025-marketplace-architecture.md) · [Inventory PRD](../06-modules/inventory-prd.md)
