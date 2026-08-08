# Indexes

## Principles

1. Every foreign key column is indexed by default — Postgres does not do this automatically, and unindexed foreign keys are a common source of slow joins and slow `ON DELETE RESTRICT` checks.
2. Every table's `organization_id` column is indexed (often as the leading column of a composite index) since virtually every query is tenant-scoped first — see [Multi-Tenancy](./multi-tenancy.md).
3. Indexes are added deliberately, justified by an actual query pattern documented in the owning module's PRD or this document — not speculatively on every column.
4. Composite index column order follows equality-then-range convention: exact-match filters (e.g., `organization_id`, `status`) before range/sort columns (e.g., `scheduled_start`).

## Required indexes by table (launch scope, non-exhaustive — see each module PRD for additions)

| Table | Index | Purpose |
|---|---|---|
| `organization_memberships` | `(user_id, organization_id)` unique | Fast Membership lookup, prevents duplicate Memberships |
| `customers` | `(organization_id, deleted_at)`; GIN `search_vector` | Tenant-scoped listing; search — see [Search Strategy](../02-architecture/search-strategy.md) |
| `properties` | `(organization_id, deleted_at)`; GIN `search_vector` on address | Tenant-scoped listing; address search |
| `property_customer_associations` | `(property_id, effective_to)`; `(customer_id, effective_to)` | Fast "current Customer of Property" and "current Properties of Customer" lookups |
| `assets` | `(property_id)`; `(organization_id)` | Property service-history lookups |
| `jobs` | `(organization_id, status)`; `(property_id)`; `(customer_id)`; `(job_number)` unique per org; GIN `search_vector` | Dispatch board queries, Property/Customer history, search |
| `job_assignments` | `(user_id)`; `(job_id)` | "My Jobs" Technician queries |
| `schedule_events` | `(scheduled_start, scheduled_end)` with GiST for overlap detection | Double-booking conflict checks — see [Scheduling](../03-domain/scheduling.md) |
| `tasks` | `(job_id)` | Job checklist load |
| `estimates` | `(job_id)`; `(organization_id, status)` | Job detail load, pending-approval lists |
| `invoices` | `(organization_id, status)`; `(job_id)`; `(due_date)` for aging reports; `(invoice_number)` unique per org | Financial reporting, invoice lookup |
| `payments` | `(invoice_id)`; `(idempotency_key)` unique | Invoice balance computation, idempotency enforcement |
| `inventory_items` | `(organization_id, sku)` unique | SKU lookup |
| `stock_movements` | `(inventory_item_id, location_id, created_at)` | Quantity-on-hand computation |
| `audit_events` | `(organization_id, entity_type, entity_id)`; `(organization_id, occurred_at)` | Entity audit trail lookup, time-range queries |
| `documents` | `(attached_to_type, attached_to_id)` | Attachment lookup |

## Full-text search indexes

Generated `tsvector` columns (see [Search Strategy](../02-architecture/search-strategy.md)) on `customers`, `contacts`, `properties`, `jobs`, `assets` are backed by GIN indexes; `pg_trgm` GIN indexes support fuzzy partial matching on name/address/phone fields specifically.

## Index maintenance

- Every new index is added in the same migration as the query pattern that needs it — not spec­ulatively.
- `EXPLAIN ANALYZE` review is required before merging any query added to a high-traffic path (Jobs, Scheduling, Financials) per [Database Instructions](../12-claude/database-instructions.md).
- Unused indexes (identified via `pg_stat_user_indexes` in production monitoring) are reviewed quarterly and removed if genuinely unused, since every index has a write-time cost.

## Related documents

[Naming Conventions](./naming-conventions.md) · [Scalability Strategy](../02-architecture/scalability-strategy.md) · [Search Strategy](../02-architecture/search-strategy.md)
