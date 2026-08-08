# ADR-007: Multi-Tenancy via Row Level Security, Membership-Based

## Status

Accepted

## Date

2026-08-08

## Context

Atlas is a multi-tenant SaaS platform where a single shared database serves every Organization (see [ADR-004](./ADR-004-postgresql.md)). Tenant data isolation is Atlas's single most important security property — a breach of isolation between Organizations would be catastrophic to the entire product's trust proposition, per [Product Principles](../00-overview/product-principles.md), principle 3.

## Problem

How should tenant isolation be enforced: application-layer filtering alone, a database-per-tenant model, or database-layer Row Level Security — and if RLS, should policies check JWT claims or live database state?

## Decision

**Row Level Security, enabled and forced on every tenant-owned table**, with policies checking **live `organization_memberships` state** (not JWT custom claims) via a `SECURITY DEFINER` helper function. Application-layer Permission checks remain a first line of defense, but RLS is the non-bypassable last line. See [Multi-Tenancy](../04-database/multi-tenancy.md), [Tenant Isolation](../07-security/tenant-isolation.md).

## Alternatives Considered

1. **Application-layer filtering only (every query manually scoped by `organization_id`)** — rejected. A single forgotten `WHERE organization_id = ...` clause in one query, anywhere in the codebase, would leak cross-tenant data — an unacceptable single point of failure given [Product Principles](../00-overview/product-principles.md) principle 3.
2. **Database-per-tenant (a separate Postgres database or schema per Organization)** — rejected. Operationally expensive at scale (migrations must run against thousands of databases), and cross-tenant reference data (Manufacturers — see [Manufacturers](../03-domain/manufacturers.md)) becomes awkward to share. RLS in a single shared database achieves the same isolation guarantee with far less operational overhead at Atlas's target scale (see [Scalability Strategy](../02-architecture/scalability-strategy.md)).
3. **RLS policies based on JWT custom claims** (`organization_id`/`role` embedded in the token) — rejected as the *primary* mechanism. A JWT is only refreshed periodically; a Role change or Membership removal wouldn't take effect until token refresh, leaving a window where a removed/downgraded User retains access. Checking live Membership state closes this window at the cost of one extra (indexed, cheap) lookup per policy evaluation.

## Consequences

- Every tenant-owned table's migration must include its RLS policies in the same migration that creates the table — see [Migrations](../04-database/migrations.md).
- Permission/Role changes take effect immediately, on the very next request — no stale-access window.
- A defense-in-depth model: an API-layer authorization bug is still contained by RLS (see [Authorization Security](../07-security/authorization-security.md)).
- Every RLS policy is a query-performance-relevant object requiring index-aware design (see [Indexes](../04-database/indexes.md)) and periodic audit (see [Tenant Isolation](../07-security/tenant-isolation.md)).

## Risks

- RLS policy bugs are subtle and high-impact — mitigated by mandatory, CI-enforced cross-tenant isolation tests for every tenant-owned table (see [Database Testing](../09-testing/database-testing.md)).
- The live-Membership-state lookup adds marginal query overhead versus a JWT-claim check — accepted as the correct trade-off given the security benefit; monitored under [Scalability Strategy](../02-architecture/scalability-strategy.md).

## Migration / Rollback

Not practically reversible — removing or weakening RLS after launch would require re-establishing trust in tenant isolation through some other, likely more complex, mechanism. This decision is treated as foundational and permanent for the platform's life.

## Related Decisions

[ADR-004: PostgreSQL](./ADR-004-postgresql.md) · [ADR-006: Authentication](./ADR-006-authentication.md) · [ADR-008: RBAC](./ADR-008-rbac.md) · [Tenant Isolation](../07-security/tenant-isolation.md)
