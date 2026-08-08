# Suppliers

## Purpose

A Supplier is a vendor an Organization purchases parts/materials from (e.g., a local plumbing supply house, an electrical distributor). At launch, Suppliers are a simple reference/purchase-order record; in Phase 4 they become the counterparty in the [Marketplace](./marketplace.md).

## Key attributes

- Name, contact info, account number (the Organization's account with that Supplier).
- Notes (preferred supplier for certain part categories).

## Relationships

- **Belongs to** one [Organization](./organization.md) (launch scope: each Organization manages its own Supplier list; a shared, platform-wide Supplier directory is a Phase 4 Marketplace concern — see [Marketplace](./marketplace.md)).
- **Referenced by** `purchase_orders` (basic, manual at launch) and, in the future, by [Inventory Items](./inventory.md) as a preferred source.

## Business rules

1. Launch-scope Suppliers are informational/organizational (a place to record "we buy this from X") plus basic manual Purchase Orders (a simple record of what was ordered and received, without any live catalog, pricing, or automated ordering integration).
2. Automated ordering, live catalogs, and pricing integration are explicitly Phase 4 (Marketplace) scope — see [Roadmap Phase 4](../13-roadmap/phase-4-marketplace.md) — and must not be implemented ahead of that phase gate.

## Data requirements

`suppliers` (`organization_id`, name, contact info, account number, `deleted_at`, timestamps), `purchase_orders` (`organization_id`, `supplier_id`, status, line items, `ordered_at`, `received_at`) — basic, launch-scope only.

## Permission requirements

Dispatcher/Admin/Owner: full management. Technician: read-only.

## Future extensions

Shared platform Supplier directory, live product catalogs, in-workflow ordering, order status tracking — see [Marketplace PRD](../06-modules/marketplace-prd.md), [Suppliers PRD](../06-modules/suppliers-prd.md).

## Related documents

[Suppliers PRD](../06-modules/suppliers-prd.md) · [Inventory](./inventory.md) · [Marketplace](./marketplace.md)
