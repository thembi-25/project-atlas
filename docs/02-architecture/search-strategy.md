# Search Strategy

## Requirement

Staff need fast, tenant-scoped search across Customers, Contacts, Properties, and Jobs (by address, name, phone, job number) — this is a daily, high-frequency interaction (Denise searching for a caller), not a nice-to-have. See [User Journeys](../00-overview/user-journeys.md), Journey 1.

## Approach: PostgreSQL full-text search

Atlas uses native PostgreSQL full-text search (`tsvector` columns with GIN indexes, `pg_trgm` for fuzzy/partial matching on names, addresses, and phone numbers) rather than a dedicated search service. See [ADR-014](../11-adr/ADR-014-search.md).

### Why this is sufficient at launch scale

- Search is always scoped to a single Organization (tenant-filtered by RLS before any ranking happens), so the effective corpus per query is thousands, not millions, of rows even for a large Organization.
- `pg_trgm` handles typo-tolerant partial matching (e.g., "123 Main St" matching "Main Street") without a separate index infrastructure.
- Combined with proper indexing (see [Indexes](../04-database/indexes.md)), this comfortably meets the p95 latency targets in [Non-Functional Requirements](../01-product/non-functional-requirements.md).

## What is indexed for search

| Entity | Searchable fields | Detail |
|---|---|---|
| Customer | name, phone, email | [Customers](../03-domain/customers.md) |
| Contact | name, phone, email | [Contacts](../03-domain/contacts.md) |
| Property | address (street, city, postal code) | [Properties](../03-domain/properties.md) |
| Job | job number, customer name (denormalized), property address (denormalized) | [Jobs](../03-domain/jobs.md) |
| Asset | manufacturer, model, serial number | [Assets](../03-domain/assets.md) |

A combined `search_vector` column (generated, weighted `tsvector`) per searchable entity is maintained via a Postgres trigger or generated column, kept in sync automatically rather than by application code remembering to update it — see [Schema Overview](../04-database/schema-overview.md).

## What is explicitly deferred

Elasticsearch, Algolia, Meilisearch, or any dedicated search service are not introduced at launch. [ADR-014](../11-adr/ADR-014-search.md) documents the specific trigger for reconsidering this: sustained search latency degradation that indexing/`pg_trgm` tuning cannot resolve, or a genuine need for search features Postgres cannot reasonably provide (e.g., semantic/vector search across job notes at very large scale) — relevant if and when the [AI Platform PRD](../06-modules/ai-platform-prd.md) grows beyond assistive drafting.

## Future: vector/semantic search

If a future AI capability requires semantic search (e.g., "find similar past jobs by symptom description"), PostgreSQL's `pgvector` extension is the first option evaluated, consistent with [Architecture Principles](./architecture-principles.md) principle 4 — not a new vector database service, unless a documented ADR shows `pgvector` is insufficient at the relevant scale.
