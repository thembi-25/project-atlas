# ADR-004: PostgreSQL as the Sole Datastore, Drizzle as the ORM

## Status

Accepted

## Date

2026-08-08

## Context

Atlas's domain (see [Domain Overview](../03-domain/domain-overview.md)) is deeply relational — Organizations, Customers, Properties, Assets, Jobs, and financial records are interconnected with strict referential integrity and tenant-isolation requirements that a relational database with mature security primitives (Row Level Security) is well-suited to enforce at the data layer itself, per [Architecture Principles](../02-architecture/architecture-principles.md).

## Problem

Which database technology (or combination of technologies) should be Atlas's system of record, and what should mediate application access to it?

## Decision

**PostgreSQL** is Atlas's sole datastore for all launch-scope needs — transactional data, search (via `tsvector`/`pg_trgm`), and job queuing (via `pg-boss`) — accessed exclusively through **Drizzle ORM**'s type-safe query builder, with Drizzle Kit managing migrations. See [Database Architecture](../04-database/database-architecture.md), [Technology Stack](../02-architecture/technology-stack.md).

## Alternatives Considered

1. **Polyglot persistence (Postgres + a NoSQL document store for flexible data, e.g., checklist responses)** — rejected. Postgres's `jsonb` columns already handle the genuinely variable-shape data (Task `response_value`, Audit Event `diff` — see [Naming Conventions](../04-database/naming-conventions.md)) without the operational cost of a second datastore, and would fragment the transactional/RLS guarantees this ADR's Context depends on.
2. **MySQL** — a credible relational alternative; rejected primarily because Postgres's Row Level Security is more mature and directly enables the tenant-isolation architecture in [ADR-007](./ADR-007-multi-tenancy.md), and Supabase's managed offering (see [ADR-005](./ADR-005-supabase.md)) is Postgres-native.
3. **Prisma ORM** — a credible alternative to Drizzle; rejected because Drizzle's SQL-closer query builder gives more direct, predictable control over generated queries (important for the RLS-interaction and performance-tuning work described in [Indexes](../04-database/indexes.md)) and has a lighter runtime footprint suited to serverless function cold-starts.
4. **Raw SQL with a lightweight query builder (no ORM)** — rejected. Loses compile-time type safety between schema and application code (see [ADR-003](./ADR-003-typescript.md)) for a marginal control benefit Drizzle already provides via its SQL-like query API.

## Consequences

- One database to operate, back up, and monitor — see [Backups](../10-devops/backups.md).
- Full ACID transactions available for the cross-entity consistency requirements described in [Event-Driven Architecture](../02-architecture/event-driven-architecture.md) (e.g., a Job completion and its Audit Event committing atomically).
- The Drizzle-generated schema is the single source of truth for types across the application (see [TypeScript Standards](../08-engineering/typescript-standards.md)).
- UUID v7 primary keys are used platform-wide for index locality and distributed-safe generation — see [Primary Keys](../04-database/primary-keys.md).

## Risks

- A single database is a single point of scaling pressure — mitigated by the staged escalation path (indexing → vertical scaling → read replicas → partitioning) in [Scalability Strategy](../02-architecture/scalability-strategy.md) before any architectural change is considered.
- Drizzle is a younger project than some alternatives (less mature ecosystem than Prisma); mitigated by its close-to-SQL design reducing the surface area where ORM-specific bugs/limitations could bite.

## Migration / Rollback

Switching ORMs later is possible without a database migration (the schema itself is standard Postgres DDL, not Drizzle-proprietary) — only the application-layer query code would need rewriting. Switching away from PostgreSQL entirely would require a full data-layer rewrite and is not a realistically reversible decision; it is treated as effectively permanent for the roadmap horizon in [Implementation Roadmap](../13-roadmap/implementation-roadmap.md).

## Related Decisions

[ADR-005: Supabase](./ADR-005-supabase.md) · [ADR-007: Multi-Tenancy](./ADR-007-multi-tenancy.md) · [ADR-014: Search](./ADR-014-search.md) · [ADR-016: Background Jobs](./ADR-016-background-jobs.md)
