# Caching Strategy

## Default position: minimize caching, maximize correctness

Financial and scheduling data must be correct, not eventually-consistent-and-fast. Atlas therefore starts with the **minimum caching necessary** and adds more only where a measured performance problem justifies the added complexity of cache invalidation. See [Architecture Principles](./architecture-principles.md), [ADR-015](../11-adr/ADR-015-caching.md).

## Layers of caching actually used at launch

1. **Next.js Data Cache / React `cache()`** for request-deduplication within a single render pass (e.g., fetching the current Organization once per request even if referenced by multiple components) — not a cross-request cache for tenant data.
2. **HTTP caching for genuinely static, non-tenant assets** (JS/CSS bundles, marketing pages) via Vercel's CDN — never applied to `/api/v1/` responses, which are always tenant-scoped and must reflect current state.
3. **PostgreSQL query performance** (proper indexing — see [Indexes](../04-database/indexes.md) — and materialized views for expensive aggregate reads like Analytics dashboards, refreshed on a schedule) substitutes for an application cache in most read-heavy cases.
4. **Client-side (mobile/web) local cache** of a Technician's assigned Jobs for the day, explicitly for offline tolerance, not for performance — see [Mobile PRD](../06-modules/mobile-prd.md). This cache is invalidated aggressively on reconnect, never trusted as authoritative.

## What is explicitly not cached

- Scheduling/dispatch board state — must always reflect the latest assignment to avoid double-booking.
- Financial totals (Invoice/Payment amounts) — always computed from the authoritative row, never a cached derived value.
- Permission/Role checks — evaluated per request against current Membership state, never cached client-side as a source of truth (the UI may optimistically hide actions, but the API always re-checks).

## When Redis (or similar) gets introduced

[ADR-015](../11-adr/ADR-015-caching.md) documents the specific triggers that would justify adding a shared application cache (e.g., Redis): sustained read latency on a specific hot path that indexing and materialized views cannot fix, or a need for cross-instance rate-limiting state that Postgres can't serve cheaply enough. Until one of those triggers is actually observed in production metrics (see [Monitoring](../10-devops/monitoring.md)), Redis is not added.

## Materialized views for Analytics

The [Analytics PRD](../06-modules/analytics-prd.md) dashboards (revenue, utilization, outstanding invoices) are backed by PostgreSQL materialized views refreshed on a scheduled interval (via the Worker, see [ADR-016](../11-adr/ADR-016-background-jobs.md)) rather than computed live on every dashboard load. This is a caching decision scoped specifically to reporting, where a few minutes of staleness is acceptable and clearly labeled to the user ("as of HH:MM"), unlike operational or financial data.

## Cache invalidation rule

Anywhere a cache is used, the invalidation trigger must be named explicitly in the code and in this document before the cache is added — "cache it and figure out invalidation later" is not permitted, per [Architecture Principles](./architecture-principles.md).
