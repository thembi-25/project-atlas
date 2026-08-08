# Database Instructions

## Before any schema change

1. Check whether the table/column already exists in [Schema Overview](../04-database/schema-overview.md) — do not create a duplicate or near-duplicate.
2. Confirm the entity is documented in [`03-domain/`](../03-domain/) with a purpose, relationships, and business rules. If not, the domain documentation is updated first, in the same PR, before/alongside the migration.
3. Determine tenant ownership: does the new table need `organization_id` directly, or is it scoped through a parent? See [Multi-Tenancy](../04-database/multi-tenancy.md).

## Every new tenant-owned table's migration must include

1. The table itself, following [Naming Conventions](../04-database/naming-conventions.md), [Primary Keys](../04-database/primary-keys.md) (UUID v7), and [Foreign Keys](../04-database/foreign-keys.md) (`ON DELETE` policy chosen deliberately per relationship type).
2. `RLS ENABLED` and `FORCE ROW LEVEL SECURITY`, plus the tenant-isolation policy (and any Role-scoped policy) in the **same migration** — see [Multi-Tenancy](../04-database/multi-tenancy.md).
3. `created_at`/`updated_at` (and `deleted_at` if the entity uses soft deletion — see [Soft Deletion](../04-database/soft-deletion.md)).
4. The audit trigger (if not already applied generically — confirm against [Audit Logging](../04-database/audit-logging.md)).
5. Indexes for the query patterns the entity is known to need — see [Indexes](../04-database/indexes.md); do not add speculative indexes.
6. `CHECK` constraints for any business rule expressible at the database layer — see [Constraints](../04-database/constraints.md).

## Migration discipline

Forward-only, additive-first, backward-compatible for at least one release — see [Migrations](../04-database/migrations.md). Never write a migration that would lock a large table unacceptably; test against realistic volume per [Database Testing](../09-testing/database-testing.md).

## Query discipline

All database access via Drizzle ORM's query builder — never raw string-concatenated SQL. Any new query on a high-traffic path (Jobs, Scheduling, Financials) requires an `EXPLAIN ANALYZE` check before merge, per [Indexes](../04-database/indexes.md).

## Never

- Bypass RLS for convenience in application code (see [Implementation Rules](./implementation-rules.md)).
- Add a column that duplicates data derivable from existing columns/tables without a stated, reviewed performance justification (denormalization is deliberate, not default).
- Hard-delete data from a table where [Soft Deletion](../04-database/soft-deletion.md) applies.

## Related documents

[Database Architecture](../04-database/database-architecture.md) · [Multi-Tenancy](../04-database/multi-tenancy.md) · [Migrations](../04-database/migrations.md) · [Implementation Rules](./implementation-rules.md)
