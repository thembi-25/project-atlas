# Database Architecture

## Summary

Project Atlas uses a single PostgreSQL 15+ database (hosted on Supabase) as the sole system of record. There is no secondary datastore, no NoSQL document store, and no separate reporting database at launch — see [Architecture Principles](../02-architecture/architecture-principles.md) and [ADR-004](../11-adr/ADR-004-postgresql.md).

## Why one database

- **Transactional integrity across modules**: a Job completing, an Invoice being generated, and an Audit Event being written must succeed or fail together (see [Event-Driven Architecture](../02-architecture/event-driven-architecture.md)) — this is trivial with one database and a single transaction, and materially harder with multiple stores.
- **Row Level Security as the tenant-isolation enforcement point** (see [Multi-Tenancy](./multi-tenancy.md)) requires the data to actually be in Postgres; splitting data across stores would fragment this guarantee.
- **PostgreSQL's built-in capabilities cover launch-scope needs** for search ([Search Strategy](../02-architecture/search-strategy.md)), queuing ([ADR-016](../11-adr/ADR-016-background-jobs.md)), and reporting (materialized views).

## Schema organization

Tables are grouped by the domain module that owns them (see [Component Architecture](../02-architecture/component-architecture.md)), using a Postgres schema per module area for physical organization and clearer ownership boundaries:

| Postgres schema | Owning module | Key tables |
|---|---|---|
| `identity` | identity | `users`, `organization_memberships`, `roles`, `permissions`, `role_permissions` |
| `org` | organization | `organizations`, `teams`, `team_members` |
| `crm` | crm | `customers`, `contacts` |
| `properties` | properties | `properties`, `buildings`, `rooms`, `assets`, `asset_types`, `property_customer_associations` |
| `jobs` | jobs | `jobs`, `tasks`, `job_assignments`, `job_assets`, `schedule_events`, `dispatch_events`, `job_types`, `service_categories`, `checklist_templates` |
| `financials` | financials | `estimates`, `estimate_line_items`, `invoices`, `invoice_line_items`, `credit_notes`, `payments` |
| `inventory` | inventory | `inventory_items`, `inventory_locations`, `stock_movements`, `job_parts`, `suppliers`, `purchase_orders` |
| `reference` | manufacturers, warranties, compliance | `manufacturers`, `warranties`, `compliance_records`, `trade_types` |
| `documents` | documents | `documents` |
| `notifications` | notifications | `notifications`, `notification_preferences` |
| `platform` | cross-cutting | `audit_events`, `domain_events`, `pgboss` (job queue, managed by the `pg-boss` library itself) |

Schema-per-module is an organizational and permissioning convenience within one physical database — it does not imply separate deployability. Cross-schema foreign keys are permitted (e.g., `jobs.jobs.customer_id → crm.customers.id`) since this is still one database, one transaction scope.

## Core cross-cutting design decisions

| Decision | Choice | Detail |
|---|---|---|
| Primary keys | UUID (v7, time-ordered) | [Primary Keys](./primary-keys.md) |
| Tenant isolation | `organization_id` column + Row Level Security | [Multi-Tenancy](./multi-tenancy.md) |
| Soft deletion | `deleted_at` nullable timestamp, on recoverable entities only | [Soft Deletion](./soft-deletion.md) |
| Audit trail | `audit_events` table, synchronous, append-only | [Audit Logging](./audit-logging.md) |
| Timestamps | `timestamptz`, UTC, `created_at`/`updated_at` on every table | [Naming Conventions](./naming-conventions.md) |
| Search | Generated `tsvector` columns + GIN indexes | [Search Strategy](../02-architecture/search-strategy.md) |
| Migrations | Drizzle Kit, forward-only, additive-first | [Migrations](./migrations.md) |

## ORM and access pattern

Application code accesses the database exclusively through Drizzle ORM's type-safe query builder, with the generated TypeScript schema as the single source of truth shared between migration definitions and application code — there is no separate, hand-maintained schema documentation that can drift from the real schema. See [ADR-004](../11-adr/ADR-004-postgresql.md), [Database Instructions](../12-claude/database-instructions.md).

## Related documents

[Schema Overview](./schema-overview.md) · [Entity Relationships](./entity-relationships.md) · [Multi-Tenancy](./multi-tenancy.md) · [Domain Overview](../03-domain/domain-overview.md)
