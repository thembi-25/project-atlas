# Integration Testing

## Scope

Application-layer use cases exercised against a real, ephemeral PostgreSQL database (a fresh Supabase-compatible local instance per test run, migrated to the current schema) — this is where Atlas's RLS policies, constraints, triggers, and cross-module orchestration are actually verified, not mocked.

## Why this layer gets outsized investment

Per [Testing Strategy](./testing-strategy.md), most of Atlas's genuine correctness risk lives in the interaction between application code and Postgres (RLS scoping, constraint enforcement, trigger-driven audit logging) — logic that a unit test mocking the database cannot meaningfully verify. See [Multi-Tenancy](../04-database/multi-tenancy.md).

## What is tested here

- **Tenant isolation**: for every tenant-owned table, a test creates two Organizations and asserts a User in Organization A cannot read/write Organization B's rows via the application-layer use case — see [Acceptance Criteria](../01-product/acceptance-criteria.md).
- **Permission scoping**: a Technician's `write_assigned` restriction actually restricts, end to end through RLS.
- **Constraint/trigger enforcement**: e.g., attempting to edit a finalized Invoice's line items is rejected by the database trigger (see [Constraints](../04-database/constraints.md)), not just by an application-layer check that could be bypassed.
- **Audit Event completeness**: every tested state-changing use case asserts exactly one corresponding Audit Event was written (see [Audit Events](../03-domain/audit-events.md)).
- **Cross-module orchestration**: e.g., completing a Job produces the expected `job.completed` domain event and, once processed by the Worker in a Worker-specific integration test, the expected Invoice draft — see [Event-Driven Architecture](../02-architecture/event-driven-architecture.md).

## Test database lifecycle

Each test file runs against a database reset to a known migrated state (via a fast schema-reset, not a full re-migration per test) with test-specific data created via factories (see [Testing Strategy](./testing-strategy.md)) and torn down after. Tests never share mutable state with each other or run in an order-dependent way.

## Example (illustrative)

```typescript
describe('Job completion — tenant isolation', () => {
  it('rejects completing a Job belonging to another Organization', async () => {
    const orgA = await factories.createOrganization();
    const orgB = await factories.createOrganization();
    const jobInOrgB = await factories.createJob({ organizationId: orgB.id });
    const userInOrgA = await factories.createUser({ organizationId: orgA.id, role: 'technician' });

    await expect(
      completeJob({ jobId: jobInOrgB.id, actingUser: userInOrgA })
    ).rejects.toThrow(NotFoundError);
  });
});
```

## Related documents

[Testing Strategy](./testing-strategy.md) · [Database Testing](./database-testing.md) · [Multi-Tenancy](../04-database/multi-tenancy.md) · [Audit Events](../03-domain/audit-events.md)
