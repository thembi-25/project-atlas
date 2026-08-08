# Database Deployment

## Migration application

Migrations (Drizzle Kit-generated SQL, see [Migrations](../04-database/migrations.md)) are applied via the Supabase CLI as part of the CI/CD pipeline (see [CI/CD](./ci-cd.md)) — never manually run against Staging/Production by an engineer's local machine, so there is always a single, auditable record (the CI run) of when and what was applied.

## Order of operations for a deploy involving a migration

1. Migration applies to the target environment's database.
2. Health check confirms the migration succeeded and the schema is in the expected state.
3. Application deployment (Next.js app, then Worker) proceeds only after migration success — a failed migration blocks the deploy pipeline entirely rather than deploying application code against a schema it doesn't expect.

## Zero-downtime migration patterns

Per [Migrations](../04-database/migrations.md)'s additive-first rule, in practice:
- Adding a column: ships and deploys before any code reads/writes it.
- Adding a `NOT NULL` column to an existing table with data: done in three steps across separate migrations — add nullable, backfill in batches (via the Worker, never a single long-running `UPDATE`), then add the `NOT NULL` constraint once backfill is confirmed complete.
- Renaming a column: add the new column, dual-write from the application for one release, backfill, switch reads to the new column, stop dual-writing, then drop the old column in a later migration — never an in-place rename that breaks the currently-deployed app version mid-deploy.

## Environment-specific migration behavior

| Environment | When migrations run |
|---|---|
| Preview | On PR open/update, against the ephemeral branch database |
| Staging | Automatically on merge to `main` |
| Production | As the first step of the manual promotion process — see [Deployment](./deployment.md) |

## Migration failure handling

A failed migration in Staging blocks further promotion until fixed (a new forward migration, per [Migrations](../04-database/migrations.md) — never a manual hotfix directly against Staging's database). A failed migration in Production is a [Disaster Recovery](./disaster-recovery.md)-tier incident: the deploy pipeline halts, the on-call engineer is paged, and the fix follows the same forward-only, reviewed migration path — a direct manual Production database edit is a last-resort, explicitly logged exception, never a routine remediation path.

## Related documents

[Migrations](../04-database/migrations.md) · [CI/CD](./ci-cd.md) · [Deployment](./deployment.md) · [Backups](./backups.md)
