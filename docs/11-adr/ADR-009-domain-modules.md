# ADR-009: Domain Modules Over Trade Verticals

## Status

Accepted

## Date

2026-08-08

## Context

Project Atlas launches with three trades (plumbing, HVAC, electrical) and has an explicit long-term vision of supporting more (see [Vision](../00-overview/vision.md)). The product brief is explicit that this must not be achieved by building separate products/schemas per trade.

## Problem

How should trade-specific differences (different equipment types, different job workflows, different checklists) be represented in the domain model and codebase — as separate trade-specific modules/schemas, or as configuration on a shared, generic model?

## Decision

A **single, generic domain model** (Organization, Property, Asset, Job, etc.) with trade differences expressed entirely through **configuration entities** — `trade_types`, `asset_types`, `job_types`, `service_categories`, `checklist_templates`/`form_definitions` — scoped per Organization with platform-provided defaults. See [Domain Overview](../03-domain/domain-overview.md#the-trade-agnostic-configuration-pattern).

## Alternatives Considered

1. **Separate schemas/tables per trade** (e.g., `plumbing_jobs`, `hvac_jobs`) — rejected outright. Would make Property Intelligence (a Property with both plumbing and HVAC Assets) incoherent, and would multiply engineering cost linearly with each new trade added — directly contradicting the platform strategy in [Product Strategy](../01-product/product-strategy.md).
2. **Separate codebases/products per trade sharing a common backend** — rejected. Even worse duplication than separate schemas; abandons the entire "platform, not point tool" positioning in [Market Positioning](../00-overview/market-positioning.md).
3. **A fully generic, schema-less/EAV (entity-attribute-value) model with no structured entities at all** — rejected. Over-corrects in the other direction: loses the referential integrity, indexability, and query performance that a properly normalized relational schema (see [Database Architecture](../04-database/database-architecture.md)) provides. The chosen approach uses structured tables for stable, well-understood entities (Job, Asset) and configuration/jsonb only for the genuinely variable parts (checklist responses, trade-specific type catalogs).

## Consequences

- Adding a fourth trade (e.g., appliance repair) is a configuration/data exercise (new `trade_types`/`asset_types`/`job_types` rows), not a schema migration or new module.
- A Property's Asset list can span multiple trades naturally in one record, which is the structural basis of Property Intelligence (see [Vision](../00-overview/vision.md), pillar 2).
- Core domain logic (Job state machine, Estimate/Invoice math) never branches on trade — trade-specific behavior lives entirely in configuration data, keeping the codebase's complexity bounded regardless of trade count.

## Risks

- Some genuinely trade-specific business logic (e.g., electrical-code-specific compliance rules) may eventually be too complex for pure configuration and could pressure the model toward code branching — mitigated by the Compliance module's [`compliance_records`](../03-domain/compliance.md) being itself configurable per Organization/trade rather than hard-coded, and by treating any future exception as requiring its own ADR rather than an ad hoc branch.

## Migration / Rollback

Not applicable in the traditional sense — this is a foundational domain-modeling decision baked into every table from the first migration. Reversing it would mean re-modeling the entire domain per-trade, which is not a realistic path; any trade-specific complexity that doesn't fit the configuration model is handled by extending the configuration schema (e.g., richer per-`job_type` rule definitions), not by abandoning the pattern.

## Related Decisions

[Domain Overview](../03-domain/domain-overview.md) · [ADR-001: Monorepo](./ADR-001-monorepo.md) · [Product Strategy](../01-product/product-strategy.md)
