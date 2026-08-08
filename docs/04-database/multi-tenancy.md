# Multi-Tenancy

## Model

Organization is the tenant boundary (see [Organization](../03-domain/organization.md)). Every tenant-owned table carries `organization_id` directly, or is scoped unambiguously through a parent that does (e.g., `contacts` through `customers.organization_id`, `tasks` through `jobs.organization_id`). See [ADR-007: Multi-Tenancy](../11-adr/ADR-007-multi-tenancy.md).

## Enforcement: Row Level Security, membership-based

Every tenant-owned table has RLS **enabled and forced** (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ... FORCE ROW LEVEL SECURITY;`, the latter ensuring even the table owner role is subject to policies). Policies check the requesting user's **current, live Membership** — not a cached JWT claim — via a helper function:

```sql
create function app.current_user_has_org_access(target_org_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from identity.organization_memberships m
    where m.user_id = auth.uid()
      and m.organization_id = target_org_id
      and m.status = 'active'
  )
$$;
```

A representative policy on a directly-owned table:

```sql
create policy tenant_isolation_select on jobs.jobs
  for select
  using (app.current_user_has_org_access(organization_id));
```

For Role-scoped restrictions (e.g., a Technician seeing only assigned Jobs), an additional policy layers on top checking `job_assignments`, combined with the base tenant-isolation policy — see [Tenant Isolation](../07-security/tenant-isolation.md) for the full policy composition pattern and worked examples per Role.

## Why membership-based, not JWT-claim-based

An alternative common pattern stores `organization_id`/Role directly as custom JWT claims and checks those in RLS policies. Atlas deliberately does **not** do this as the primary mechanism: a JWT is only refreshed periodically, so a Role change or Membership removal wouldn't take effect until the user's token refreshes — an unacceptable window for a removed employee or downgraded Technician. Checking live `organization_memberships` state on every request closes that window immediately, at the cost of one extra (well-indexed, cheap) lookup per policy evaluation. See [ADR-007](../11-adr/ADR-007-multi-tenancy.md) for the full trade-off discussion.

## Indirectly-scoped tables

Tables without their own `organization_id` column (e.g., `contacts`, `tasks`, `estimate_line_items`) use an RLS policy that joins to their parent's `organization_id` rather than duplicating the column purely for RLS convenience — denormalizing `organization_id` onto every child table is avoided unless a specific query-performance need justifies it (documented per table in [Schema Overview](./schema-overview.md) if so).

## Cross-tenant reference data

`manufacturers` and platform reference tables (`trade_types`, `permissions`, `roles`) are **not** RLS-tenant-scoped — they are readable by all authenticated Organizations by design (see [Manufacturers](../03-domain/manufacturers.md)). RLS is still enabled on these tables to restrict write access to platform-admin operations only.

## Testing requirement

Every table with RLS enabled must have an automated test asserting that a User from Organization A cannot read or write a row belonging to Organization B, run in CI for every PR touching schema or policies. See [Database Testing](../09-testing/database-testing.md), [Security Testing](../09-testing/security-testing.md).

## Related documents

[Tenant Isolation](../07-security/tenant-isolation.md) · [Organization](../03-domain/organization.md) · [ADR-007](../11-adr/ADR-007-multi-tenancy.md) · [Authorization](../05-api/authorization.md)
