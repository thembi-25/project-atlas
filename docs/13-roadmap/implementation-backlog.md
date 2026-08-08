# Implementation Backlog

## Purpose

Cross-phase items that are documented and real, but not yet scheduled into a specific phase or sprint — tracked here so they aren't lost, and so a future planning pass has a starting point rather than needing to rediscover them from scratch. See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md) for the Strategic Product Phase / Technical Implementation Phase / Sprint numbering used throughout this document.

## Deferred from launch scope (see [Product Scope](../01-product/product-scope.md))

- Full offline sync with conflict resolution for the Mobile PWA — see [Mobile PRD](../06-modules/mobile-prd.md), Future Extensions.
- Custom, per-Organization Roles — see [Roles](../03-domain/roles.md), Future Extensions.
- Multi-branch/multi-location support within a single Organization — see [Organization](../03-domain/organization.md), Future Extensions.
- Native mobile app (if PWA limitations are ever demonstrated) — see [ADR-024](../11-adr/ADR-024-mobile-strategy.md).
- SSO/SAML for larger future customers — see [Identity PRD](../06-modules/identity-prd.md), Future Extensions.
- Non-U.S. tax/currency/compliance support — see [Product Scope](../01-product/product-scope.md).
- Recurring/maintenance-contract Jobs — see [Jobs PRD](../06-modules/jobs-prd.md), Future Extensions.
- OCR on Asset nameplate photos — see [Assets PRD](../06-modules/assets-prd.md), Future Extensions.
- Two-way SMS/Customer replies — see [Notifications PRD](../06-modules/notifications-prd.md), Future Extensions.

## Deferred infrastructure decisions (revisit only when their documented trigger occurs)

- Redis/shared application cache — trigger documented in [ADR-015](../11-adr/ADR-015-caching.md).
- Dedicated search service (Elasticsearch/Algolia) — trigger documented in [ADR-014](../11-adr/ADR-014-search.md).
- Database read replicas / table partitioning beyond `audit_events` — triggers documented in [Scalability Strategy](../02-architecture/scalability-strategy.md).
- Module extraction into independent services — trigger documented in [Scalability Strategy](../02-architecture/scalability-strategy.md), [ADR-001](../11-adr/ADR-001-monorepo.md).

## Open product questions requiring business/human decisions (see [`DOCUMENTATION-CONSISTENCY-REPORT.md`](../DOCUMENTATION-CONSISTENCY-REPORT.md) for the full list)

- Exact pricing tier price points — see [Pricing Strategy](../01-product/pricing-strategy.md).
- Whether a free/forever tier exists for the smallest businesses.
- Production domain name and branding assets.
- External penetration test scheduling — see [Security Testing](../09-testing/security-testing.md).
- Strategic Phase 6 (Industry Data Network)'s data-rights/consent legal framework — see [Phase 7: Industry Data Network](./phase-7-industry-network.md).

## Process for pulling an item off this backlog

An item moves from this backlog into a specific phase/sprint only when: (1) its phase's dependencies are met per [Implementation Roadmap](./implementation-roadmap.md), and (2) any open question blocking it (pricing decision, legal review, etc.) has been resolved by the appropriate human decision-maker — never implemented speculatively ahead of that resolution.

## Related documents

[ROADMAP-DECISION.md](./ROADMAP-DECISION.md) · [Implementation Roadmap](./implementation-roadmap.md) · [`DOCUMENTATION-CONSISTENCY-REPORT.md`](../DOCUMENTATION-CONSISTENCY-REPORT.md) · [Product Scope](../01-product/product-scope.md)
