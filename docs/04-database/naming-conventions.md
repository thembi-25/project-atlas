# Database Naming Conventions

## Tables

- Plural, `snake_case`: `customers`, `job_assignments`, `inventory_items`.
- Join/link tables name both sides: `organization_memberships`, `role_permissions`, `job_assets`.
- No Postgres reserved words, no abbreviations that aren't already standard in this documentation's [Terminology](../00-overview/terminology.md) (e.g., use `organization_id`, never `org_id`, in column names — even though the `org` schema name is a permitted physical grouping shorthand).

## Columns

- `snake_case`, singular concept names: `first_name`, `status`, `total`.
- Primary key: always `id` (UUID). See [Primary Keys](./primary-keys.md).
- Foreign keys: `<referenced_entity_singular>_id`, e.g., `customer_id`, `property_id`, `job_id`. See [Foreign Keys](./foreign-keys.md).
- Tenant column: always `organization_id` where directly present. See [Multi-Tenancy](./multi-tenancy.md).
- Booleans: `is_<adjective>` or `<verb>_enabled`, e.g., `is_primary`, `portal_access_enabled` — never a bare adjective without a prefix (`primary` alone is ambiguous).
- Timestamps: `<verb>_at` in `timestamptz`, e.g., `created_at`, `updated_at`, `deleted_at`, `finalized_at`, `occurred_at`. Dates without time (e.g., `install_date`, `due_date`) use `date`, not `timestamptz`, and are named `<noun>_date`.
- Enums/status columns: named `status` or `type` where there is exactly one such classifying column per table; if a table needs more than one, both are fully named (`asset_type_id`, `warranty_type`).
- Money columns: `numeric(12,2)` (never `float`/`double precision`), named `<noun>_total`, `unit_price`, `amount`, always paired with an implicit USD assumption documented at the column/table level until multi-currency is in scope (not at launch — see [Product Scope](../01-product/product-scope.md)).
- JSON columns: `jsonb`, never `json`, named for their content (`diff`, `response_value`), used only where the shape is genuinely variable (Task responses, Audit Event diffs) — never as a substitute for proper relational columns for known, fixed-shape data.

## Indexes

- Named `idx_<table>_<column(s)>`, e.g., `idx_jobs_organization_id_status`. See [Indexes](./indexes.md).

## Constraints

- Primary key: `pk_<table>`. Foreign key: `fk_<table>_<referenced_table>`. Unique: `uq_<table>_<column(s)>`. Check: `chk_<table>_<rule>`. See [Constraints](./constraints.md).

## Enum values

- `snake_case`, stable, never renumbered/reused after removal from active use — a retired status value is deprecated in application logic, not deleted from the database enum type, since historical rows may still reference it.

## Postgres schemas (physical grouping)

`identity`, `org`, `crm`, `properties`, `jobs`, `financials`, `inventory`, `reference`, `documents`, `notifications`, `platform` — see [Database Architecture](./database-architecture.md) for the full mapping. Schema names are short groupings, not abbreviations of business terms — the business terms themselves (as used in [Terminology](../00-overview/terminology.md)) always appear in full in table/column names.

## Consistency rule

Every table/column name must trace back to a term defined in [Terminology](../00-overview/terminology.md) or be a well-understood technical/audit column (`id`, `created_at`, `deleted_at`, etc.) documented here. New business terms are added to Terminology before they appear as schema objects.
