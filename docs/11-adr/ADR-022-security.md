# ADR-022: Defense-in-Depth Security Model

## Status

Accepted

## Date

2026-08-08

## Context

Atlas holds multi-tenant business, financial, and PII data. A single-layer security model (e.g., relying solely on application-layer authorization checks) creates a single point of failure where one bug can expose data across every Organization on the platform.

## Problem

Should Atlas rely on a single, well-implemented authorization layer, or deliberately duplicate enforcement across multiple independent layers?

## Decision

Atlas adopts an explicit **defense-in-depth** security model: authentication (Supabase Auth), API-layer authorization (Role/Permission checks), database-layer authorization (Row Level Security), and data integrity (constraints/triggers) are each independently enforced, such that a failure in any single layer does not result in a tenant-isolation or data-integrity breach. See [Security Architecture](../07-security/security-architecture.md).

## Alternatives Considered

1. **API-layer authorization only, with a trusted/service-role database connection** — rejected. Makes every future endpoint's authorization correctness a single point of failure for the entire platform's tenant isolation guarantee — an unacceptable risk profile given [Product Principles](../00-overview/product-principles.md), principle 3.
2. **Database-layer RLS only, with minimal API-layer checks** — rejected. RLS alone doesn't provide the clean, request-time `403`-with-clear-message UX the API needs (see [Authorization](../05-api/authorization.md)), and duplicating checks at both layers costs little relative to the safety margin gained.

## Consequences

- Every new endpoint requires both an API-layer Permission check and, for any new table, an RLS policy — a small but consistent extra implementation cost per feature, treated as non-negotiable per [Definition of Done](../12-claude/definition-of-done.md).
- Security-relevant regressions are caught even when one layer has a bug, verified by the mandatory RLS/authorization test suites in [Database Testing](../09-testing/database-testing.md) and [Security Testing](../09-testing/security-testing.md).
- This model extends to data integrity generally (application validation + database constraints — see [Constraints](../04-database/constraints.md)), not just tenant isolation.

## Risks

- Slight duplication of logic (a Role check exists both in a route handler and implicitly reflected in an RLS policy) creates a maintenance surface where the two could drift — mitigated by both being derived from the same documented Role-to-Permission mapping in [Roles](../03-domain/roles.md), reviewed together whenever either changes.

## Migration / Rollback

Not applicable — this is Atlas's foundational security posture, established from the first schema migration and the first route handler, and is not a decision expected to be revisited.

## Related Decisions

[Security Architecture](../07-security/security-architecture.md) · [Tenant Isolation](../07-security/tenant-isolation.md) · [ADR-007: Multi-Tenancy](./ADR-007-multi-tenancy.md) · [ADR-008: RBAC](./ADR-008-rbac.md)
