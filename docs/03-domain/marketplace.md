# Marketplace

## Purpose

The Marketplace is the future commerce layer connecting Organizations to [Suppliers](./suppliers.md) for in-workflow parts ordering — a Technician short a part on a Job can order it from a connected Supplier directly, without leaving Atlas. This is Vision pillar 3; it is documented now for domain-model completeness but is **not built at launch** (Phase 4 — see [Roadmap Phase 4](../13-roadmap/phase-4-marketplace.md)).

## Key attributes (planned)

- `marketplace_listings`: Supplier-provided product catalog entries (SKU, price, availability), mapped to Atlas's `inventory_items`/`asset_types` taxonomy.
- `marketplace_orders`: an order placed from within a Job/Inventory context, referencing one or more listings, with status tracking (placed, confirmed, shipped, delivered, cancelled).
- `supplier_connections`: the Organization's opt-in connection to a given Supplier's Marketplace presence (credentials/account linkage, distinct from the launch-scope informational `suppliers` record).

## Relationships (planned)

- **Connects** [Organization](./organization.md) and [Supplier](./suppliers.md).
- **Referenced by** [Jobs](./jobs.md)/[Inventory](./inventory.md) as the source of a reorder.

## Business rules (planned, for future implementation)

1. Marketplace order placement must never block a Job's completion — a Technician can complete a Job while a part reorder is still in transit; the reorder replenishes Inventory for future Jobs, it does not gate the current one.
2. Marketplace take-rate/commercial terms are a platform-level business model concern (see [Business Objectives](../00-overview/business-objectives.md)) and must be transparent to the Organization at the line-item level, consistent with [Product Principles](../00-overview/product-principles.md), principle 9 (no black-box data/pricing).
3. A `marketplace_listing` maps to Atlas's existing `inventory_items` taxonomy rather than introducing a parallel product data model — Marketplace extends Inventory, it doesn't duplicate it.

## Why this is documented but not built

Per [Product Strategy](../01-product/product-strategy.md), Marketplace requires a credible base of active Organizations transacting real Job/Inventory volume before Supplier partnerships are commercially viable. Building Marketplace infrastructure before that base exists would be premature investment against an unvalidated assumption.

## Related documents

[Marketplace PRD](../06-modules/marketplace-prd.md) · [Suppliers](./suppliers.md) · [Inventory](./inventory.md) · [ADR-025: Marketplace Architecture](../11-adr/ADR-025-marketplace-architecture.md) · [Roadmap Phase 4](../13-roadmap/phase-4-marketplace.md)
