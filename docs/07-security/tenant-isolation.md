# Tenant Isolation

## The guarantee

No Organization can ever read, write, or infer the existence of another Organization's data, under any application code path, including a buggy one. This is Atlas's single most important security property, given [Product Principles](../00-overview/product-principles.md) principle 3.

## Enforcement: Row Level Security, always the last word

Every tenant-owned table has RLS **enabled and forced**. See [Multi-Tenancy](../04-database/multi-tenancy.md) for the full mechanism (membership-based policies checking live `organization_memberships` state). This document covers the security-specific guarantees and how they're verified.

## Worked policy example: Technician-scoped Job access

```sql
-- Base tenant isolation (applies to every Role)
create policy jobs_tenant_isolation on jobs.jobs
  for select
  using (app.current_user_has_org_access(organization_id));

-- Additional restriction for Technician-only visibility
create policy jobs_technician_scope on jobs.jobs
  for select
  using (
    app.current_user_has_role(organization_id, 'technician')
    and not app.current_user_has_role(organization_id, 'dispatcher','admin','owner','accountant')
    implies exists (
      select 1 from jobs.job_assignments ja
      where ja.job_id = jobs.jobs.id and ja.user_id = auth.uid()
    )
  );
```

Multiple `SELECT` policies on the same table combine with `OR` in Postgres by default; Atlas's actual policy design uses a single, carefully composed policy per operation (not multiple independently-OR'd policies) specifically to avoid the common RLS pitfall where a broad policy accidentally re-grants access a narrower policy meant to restrict — this composition is documented per-table in each module's PRD "Permission Requirements" section and reviewed accordingly.

## Why `404`, not `403`, for cross-tenant access

Established in [Authorization](../05-api/authorization.md): returning `403` for a resource in another Organization would confirm that resource's existence, a minor but real information leak. Every cross-tenant lookup returns `404`.

## Verification

1. **Automated tests, every PR**: any migration or policy change touching a tenant-owned table runs the standard cross-tenant-isolation test suite (Organization A cannot read/write Organization B's rows) in CI — see [Database Testing](../09-testing/database-testing.md).
2. **RLS is forced, not just enabled**: `FORCE ROW LEVEL SECURITY` ensures even the table-owning database role is subject to policies, closing the common gap where RLS is bypassed by a superuser/owner connection used out of convenience.
3. **No `SECURITY DEFINER` shortcuts around RLS** without an explicit, reviewed justification — most application queries use the caller's own RLS-scoped context, not a privilege-elevating function.
4. **Periodic policy audit**: RLS policies across all tables are reviewed quarterly (or on any schema change) for both correctness and query-plan performance (see [Scalability Strategy](../02-architecture/scalability-strategy.md)).

## Cross-tenant reference data is the one deliberate exception

`manufacturers`, `trade_types`, `permissions`, `roles` are intentionally readable across all Organizations, as documented in [Multi-Tenancy](../04-database/multi-tenancy.md) — this is an explicit, reviewed design decision, not a gap.

## Related documents

[Multi-Tenancy](../04-database/multi-tenancy.md) · [Authorization](../05-api/authorization.md) · [Authorization Security](./authorization-security.md) · [Database Testing](../09-testing/database-testing.md) · [ADR-007](../11-adr/ADR-007-multi-tenancy.md)
