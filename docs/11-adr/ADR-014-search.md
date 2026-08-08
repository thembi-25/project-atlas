# ADR-014: PostgreSQL Full-Text Search Over a Dedicated Search Service

## Status

Accepted

## Date

2026-08-08

## Context

Staff need fast, typo-tolerant search across Customers, Contacts, Properties, and Jobs (see [User Journeys](../00-overview/user-journeys.md), Journey 1) — a frequent, latency-sensitive interaction, but always scoped to a single Organization's data (thousands, not millions, of rows per query).

## Problem

Should Atlas introduce a dedicated search service (Elasticsearch, Algolia, Meilisearch) or use PostgreSQL's native full-text search capabilities?

## Decision

**PostgreSQL native full-text search** (`tsvector`/GIN indexes, `pg_trgm` for fuzzy matching) — no dedicated search service at launch. See [Search Strategy](../02-architecture/search-strategy.md).

## Alternatives Considered

1. **Elasticsearch** — rejected per [Architecture Principles](../02-architecture/architecture-principles.md), principle 4: a powerful, general-purpose search engine solving problems (massive corpus search, complex relevance tuning across unstructured text at huge scale) Atlas doesn't have, given search is always tenant-scoped to a small effective corpus. Adds a second datastore to keep in sync with Postgres, a real and unjustified operational cost at this scale.
2. **Algolia/Meilisearch (managed search-as-a-service)** — rejected for the same reasons: real capability, but unjustified given tenant-scoped corpus size, plus an added vendor dependency and data-sync complexity (keeping the external index consistent with Postgres as the source of truth).

## Consequences

- No secondary index to keep synchronized — `tsvector` columns are generated/maintained directly by Postgres from the same row, eliminating an entire class of sync-lag bugs a separate search service would introduce.
- Search relevance tuning is bounded by what Postgres's text search supports — sufficient for name/address/phone-style lookups (see [Search Strategy](../02-architecture/search-strategy.md)), not intended for large-corpus relevance ranking.
- Search performance is verified under realistic tenant data volume as part of [Performance Testing](../09-testing/performance-testing.md).

## Risks

- If a future need arises for search across genuinely large, cross-tenant, or unstructured corpora (e.g., semantic search across all Job notes for a large Organization, or a future Industry Data Network aggregate search — see [Roadmap Phase 7](../13-roadmap/phase-7-industry-network.md)), Postgres's native search may become insufficient — the specific trigger for reconsidering is documented in [Search Strategy](../02-architecture/search-strategy.md): sustained latency degradation that indexing/tuning cannot resolve.

## Migration / Rollback

If a dedicated search service is ever justified, it would be introduced as an additive, eventually-consistent secondary index (Postgres remaining the source of truth) rather than a replacement — the existing `tsvector` columns and their consuming API endpoints would remain functional during any such transition, minimizing risk of the change itself.

## Related Decisions

[Search Strategy](../02-architecture/search-strategy.md) · [ADR-004: PostgreSQL](./ADR-004-postgresql.md) · [Indexes](../04-database/indexes.md)
