# Database Testing

## Scope

Tests specifically targeting the database layer itself — RLS policies, constraints, triggers, and migrations — independent of (though often exercised through) [Integration Testing](./integration-testing.md).

## RLS policy tests (mandatory for every tenant-owned table)

For every table with RLS enabled, a standard test suite (parameterized across all such tables, not hand-written per table where the pattern is identical) verifies:
1. A User in Organization A cannot `SELECT` a row belonging to Organization B.
2. A User in Organization A cannot `INSERT`/`UPDATE`/`DELETE` a row targeting Organization B (attempting to do so fails, not silently no-ops).
3. Role-scoped policies (e.g., Technician `write_assigned`) correctly restrict beyond base tenant isolation.
4. The base table owner/service role is still subject to RLS (`FORCE ROW LEVEL SECURITY` is actually in effect) — a regression here is tested explicitly since it's the single most catastrophic possible misconfiguration.

See [Tenant Isolation](../07-security/tenant-isolation.md) for the policies these tests verify.

## Constraint and trigger tests

- Every `CHECK` constraint and business-rule-enforcing trigger listed in [Constraints](../04-database/constraints.md) has a corresponding test asserting the invalid case is actually rejected at the database layer (not just caught by application-layer validation, which a direct database connection could bypass).
- Financial immutability: a direct attempt to `UPDATE` a finalized Invoice's line items is tested to fail even when issued as a raw database statement bypassing the application layer entirely, confirming the trigger — not just the API — enforces it.
- Audit trigger completeness: every covered table's `INSERT`/`UPDATE`/`DELETE` is tested to produce exactly one `audit_events` row.

## Migration tests

- Every migration is tested against a copy of a realistic-volume dataset in CI (see [Migrations](../04-database/migrations.md)) to catch a migration that would lock a large table unacceptably in Production.
- Backward-compatibility tests: after a migration, the *previous* application version's queries are run against the new schema to confirm they still succeed — verifying the additive-first, rollback-safe migration discipline in [Migrations](../04-database/migrations.md) actually holds.

## Seed data tests

[Seed Data](../04-database/seed-data.md) (Roles, Permissions, `role_permissions`, `trade_types`) is tested for referential completeness (e.g., every Role has at least the Permissions documented in [Roles](../03-domain/roles.md#role-to-module-access-summary)) on every CI run, catching drift between the seed migration and the documented Role-to-Permission mapping.

## Related documents

[Multi-Tenancy](../04-database/multi-tenancy.md) · [Constraints](../04-database/constraints.md) · [Migrations](../04-database/migrations.md) · [Tenant Isolation](../07-security/tenant-isolation.md)
