# ADR-005: Supabase as the Managed Data Platform

## Status

Accepted

## Date

2026-08-08

## Context

Having decided on PostgreSQL ([ADR-004](./ADR-004-postgresql.md)), Atlas needs a managed hosting platform providing the database plus adjacent, genuinely-needed capabilities (authentication, file storage) without each requiring separate vendor integration and operational overhead — consistent with the anti-overengineering mandate in [Architecture Principles](../02-architecture/architecture-principles.md).

## Problem

Should Atlas self-host/manage its own PostgreSQL and auth infrastructure, or use a managed platform — and if managed, which one?

## Decision

**Supabase** is Atlas's managed data platform: PostgreSQL hosting, Supabase Auth (authentication), Supabase Storage (file storage), and database branching for Preview environments. See [Technology Stack](../02-architecture/technology-stack.md), [Deployment Architecture](../02-architecture/deployment-architecture.md).

## Alternatives Considered

1. **Self-managed PostgreSQL (e.g., on AWS RDS) + a separate auth provider (e.g., Auth0/Clerk) + a separate storage provider (e.g., S3 directly)** — rejected. Fragments what Supabase provides as one coherent platform into three vendor relationships and three sets of operational tooling, for a small team where that overhead isn't justified at launch scale.
2. **Firebase/Firestore** — rejected outright: not PostgreSQL, incompatible with the relational, RLS-based architecture this entire documentation set is built around (see [ADR-004](./ADR-004-postgresql.md)).
3. **PlanetScale (MySQL-compatible) or Neon (Postgres, serverless-focused)** — credible database-only alternatives; rejected because neither bundles auth/storage as tightly as Supabase, and Supabase's Row Level Security tooling is more directly aligned with the tenant-isolation architecture in [ADR-007](./ADR-007-multi-tenancy.md).

## Consequences

- One vendor relationship covers database, auth, and storage — see [Container Architecture](../02-architecture/container-architecture.md).
- Database branching gives cheap, realistic Preview environments per pull request — see [Deployment Architecture](../02-architecture/deployment-architecture.md).
- Atlas is not locked into Supabase-proprietary features beyond standard Postgres + its Auth/Storage APIs — the underlying database remains portable standard PostgreSQL (see [ADR-004](./ADR-004-postgresql.md)), limiting lock-in primarily to the Auth and Storage integration surfaces.

## Risks

- Vendor dependency for auth and storage availability — mitigated by Supabase Auth/Storage being reasonably standard (JWT-based auth, S3-compatible storage) such that a future migration, while real work, is not a full architectural rewrite.
- Supabase's pricing/scaling characteristics at very large scale are not yet proven for Atlas's specific access patterns — monitored as part of [Scalability Strategy](../02-architecture/scalability-strategy.md) and revisited if cost/performance at scale diverges from expectations.

## Migration / Rollback

Because the database itself is standard PostgreSQL, migrating off Supabase to self-hosted or another managed Postgres provider is possible (a data export/import plus reimplementing the Auth/Storage integration layer) without redesigning the schema or domain model — this is a real, bounded migration path, not a rewrite, should it ever be needed.

## Related Decisions

[ADR-004: PostgreSQL](./ADR-004-postgresql.md) · [ADR-006: Authentication](./ADR-006-authentication.md) · [ADR-013: File Storage](./ADR-013-file-storage.md) · [ADR-007: Multi-Tenancy](./ADR-007-multi-tenancy.md)
