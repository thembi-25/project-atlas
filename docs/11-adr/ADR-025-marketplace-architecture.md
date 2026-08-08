# ADR-025: Marketplace as an Extension of Inventory, Not a Parallel System

## Status

Accepted (design decision for a future phase — see [Strategic Phase 3](../13-roadmap/phase-4-marketplace.md))

## Date

2026-08-08

## Context

The Supplier Marketplace (Vision pillar 3 — see [Vision](../00-overview/vision.md)) is a Strategic Phase 3 capability, not launch scope, but its data-model shape needs to be decided now so the launch-scope [Inventory](../03-domain/inventory.md) and [Suppliers](../03-domain/suppliers.md) modules aren't built in a way that has to be reworked when Marketplace arrives.

## Problem

Should Marketplace listings/orders be modeled as an entirely separate product-catalog system, or as an extension of Atlas's existing Inventory Item taxonomy?

## Decision

Marketplace `marketplace_listings` map directly onto Atlas's existing `inventory_items` taxonomy; a Marketplace order is fundamentally a Supplier-fulfilled restock of Inventory, not a parallel commerce entity with its own product model. See [Marketplace](../03-domain/marketplace.md).

## Alternatives Considered

1. **A fully independent Marketplace product catalog and order system**, later reconciled/mapped to Inventory — rejected. Would create two sources of truth for "what is this part" (an Inventory Item and a separate Marketplace listing), risking exactly the kind of data-model duplication [Product Principles](../00-overview/product-principles.md) and [Architecture Principles](../02-architecture/architecture-principles.md) warn against, and complicating the Job-costing flow that already depends on `inventory_items`/`job_parts` (see [Inventory](../03-domain/inventory.md)).
2. **Building Marketplace now, ahead of Strategic Phase 3, to avoid future rework** — rejected. Contradicts the explicit phase-gating rationale in [Product Strategy](../01-product/product-strategy.md): Marketplace requires a credible base of active Organizations before Supplier partnerships are viable, and building the infrastructure before that base exists is premature investment against an unvalidated assumption.

## Consequences

- Launch-scope Inventory/Suppliers modules are built with Marketplace-readiness in mind (a clean, well-normalized `inventory_items` taxonomy — see [Schema Overview](../04-database/schema-overview.md)) without any Marketplace-specific code shipping early.
- When Strategic Phase 3 begins, `marketplace_listings` and `marketplace_orders` are additive tables referencing existing `inventory_items`/`suppliers`, not a schema redesign.
- Job costing (`job_parts.unit_cost_at_time` — see [Inventory](../03-domain/inventory.md)) continues to work identically whether a part came from manual stock or a Marketplace-fulfilled order.

## Risks

- Real-world Supplier catalogs may not map cleanly 1:1 onto Atlas's `inventory_items` taxonomy (a Supplier's SKU granularity may differ) — this is a genuine future design challenge, tracked as an open question for Strategic Phase 3 design work rather than resolved prematurely now.

## Migration / Rollback

Not applicable at this stage — no Marketplace code exists yet. This ADR constrains *how* Strategic Phase 3 implementation begins, not a system already built and needing to be unwound.

## Related Decisions

[Marketplace](../03-domain/marketplace.md) · [Marketplace PRD](../06-modules/marketplace-prd.md) · [Inventory](../03-domain/inventory.md) · [Strategic Phase 3](../13-roadmap/phase-4-marketplace.md)
