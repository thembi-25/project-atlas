# Foreign Keys

## Standard

Every foreign key is a real, enforced Postgres `FOREIGN KEY` constraint referencing another table's UUID `id` — Atlas does not use "soft" application-only references. Referential integrity is a database guarantee, consistent with [Architecture Principles](../02-architecture/architecture-principles.md).

## Naming

`<referencing_table>.<referenced_entity_singular>_id`, constraint named `fk_<table>_<referenced_table>` — see [Naming Conventions](./naming-conventions.md).

## `ON DELETE` behavior by relationship type

| Relationship | `ON DELETE` behavior | Rationale |
|---|---|---|
| Required parent, soft-deleted entity (e.g., `jobs.property_id → properties.id`) | `RESTRICT` | The parent's own [Soft Deletion](./soft-deletion.md) flow, not a hard `DELETE`, is how these are ever removed — a hard `DELETE` should never reach a row with children, and `RESTRICT` makes that a loud failure instead of a silent cascade. |
| Owned child records with no independent lifecycle (e.g., `estimate_line_items.estimate_id → estimates.id`, `tasks.job_id → jobs.id`) | `CASCADE` | These rows have no meaning without their parent and are never independently referenced elsewhere. |
| Optional reference to another aggregate (e.g., `jobs.contact_id → contacts.id`) | `SET NULL` | Losing the specific Contact reference shouldn't block or cascade-delete the Job. |
| Append-only audit/history rows referencing a possibly-deleted actor (e.g., `audit_events.actor_user_id → users.id`) | `SET NULL` (with `actor_type` preserving that a user *did* exist) | Historical records must survive the referenced User being removed from an Organization. |
| Platform-shared reference data (e.g., `assets.manufacturer_id → manufacturers.id`) | `RESTRICT` (manufacturers are never hard-deleted, only deactivated — see [Manufacturers](../03-domain/manufacturers.md)) | Prevents an accidental delete of shared reference data that many Organizations depend on. |

`CASCADE` is never used across an `organization_id` boundary implicitly — deleting an Organization (a rare, deliberate, soft-first operation — see [Organization](../03-domain/organization.md)) is handled by an explicit, application-orchestrated deactivation flow, not a blind `ON DELETE CASCADE` from the `organizations` table, since the blast radius of getting that wrong is total data loss for a tenant.

## Cross-schema foreign keys

Because Atlas uses Postgres schemas only for organizational grouping within one database (see [Database Architecture](./database-architecture.md)), foreign keys freely cross schema boundaries (e.g., `jobs.jobs.customer_id` in the `jobs` schema references `crm.customers.id` in the `crm` schema) and are fully enforced like any other foreign key.

## Nullable foreign keys

A nullable foreign key column always represents a genuinely optional relationship (e.g., `jobs.contact_id`, `assets.building_id`) — never used as a workaround for a relationship that's actually required but inconvenient to backfill; required relationships are `NOT NULL` from the first migration that introduces the column.

## Related documents

[Primary Keys](./primary-keys.md) · [Constraints](./constraints.md) · [Entity Relationships](./entity-relationships.md)
