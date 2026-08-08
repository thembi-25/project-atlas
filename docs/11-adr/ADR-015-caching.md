# ADR-015: Minimal Caching, No Redis at Launch

## Status

Accepted

## Date

2026-08-08

## Context

Much of Atlas's data (scheduling state, financial totals, permissions) must always reflect current state — stale cached data in these areas isn't a performance optimization, it's a correctness bug (a double-booked Technician, an incorrect Invoice balance). See [Product Principles](../00-overview/product-principles.md), principle 7.

## Problem

Should Atlas introduce a shared application cache (e.g., Redis) at launch to improve read performance, or rely on database-level performance techniques and framework-native request-scoped caching?

## Decision

**No shared application cache (Redis or similar) at launch.** Performance needs are met via proper indexing, PostgreSQL materialized views for reporting aggregates, and Next.js's request-scoped data cache/React `cache()` for within-request deduplication only. See [Caching Strategy](../02-architecture/caching-strategy.md).

## Alternatives Considered

1. **Redis for general-purpose caching from day one** — rejected per [Architecture Principles](../02-architecture/architecture-principles.md), principle 4: adds a new infrastructure dependency, a new failure mode (cache/database inconsistency), and cache-invalidation complexity for a performance problem not yet demonstrated at launch scale. The specific risk (stale financial/scheduling data) is also disproportionately dangerous for Atlas's domain compared to a typical content-heavy application where caching is lower-risk.
2. **Aggressive HTTP caching on `/api/v1/` responses** — rejected. All API responses are tenant-scoped and must reflect current state; HTTP caching is reserved for genuinely static, non-tenant assets only (see [Caching Strategy](../02-architecture/caching-strategy.md)).

## Consequences

- No cache-invalidation bugs to debug for the majority of Atlas's read paths.
- Reporting/Analytics dashboards use materialized views (a deliberate, narrow, clearly-labeled staleness — "as of HH:MM," see [Analytics](../03-domain/analytics.md)) rather than a general cache, keeping the one place staleness is acceptable explicit and bounded.
- Performance work focuses first on indexing/query design (see [Indexes](../04-database/indexes.md)), which is both simpler to reason about and directly benefits every consumer of a query, not just cache-hit requests.

## Risks

- If a specific read path's latency genuinely can't be solved by indexing/materialized views at scale, the team will need to introduce Redis under time pressure rather than proactively — mitigated by [Scalability Strategy](../02-architecture/scalability-strategy.md) and [Performance Testing](../09-testing/performance-testing.md) monitoring for exactly this signal well before it becomes a production incident.

## Migration / Rollback

Introducing Redis later is purely additive — no existing code needs to change to remove a cache that was never added. The specific triggers for reconsidering (sustained, tuning-resistant latency on a specific path, or a genuine cross-instance rate-limiting state need) are documented in [Caching Strategy](../02-architecture/caching-strategy.md) and [Rate Limiting](../05-api/rate-limiting.md).

## Related Decisions

[Caching Strategy](../02-architecture/caching-strategy.md) · [Scalability Strategy](../02-architecture/scalability-strategy.md) · [Analytics](../03-domain/analytics.md)
