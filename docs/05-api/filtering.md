# Filtering

## Convention

Filters are plain query parameters matching a field name, using suffix operators for non-equality comparisons:

```http
GET /api/v1/jobs?status=scheduled&priority=urgent&created_at[gte]=2026-08-01T00:00:00Z&created_at[lt]=2026-09-01T00:00:00Z
```

| Suffix | Meaning |
|---|---|
| (none) | Equality |
| `[gte]` / `[gt]` | Greater than or equal / greater than |
| `[lte]` / `[lt]` | Less than or equal / less than |
| `[in]` | Comma-separated list, matches any (`?status[in]=scheduled,dispatched`) |
| `[search]` | Full-text search against the entity's indexed `search_vector` (see [Search Strategy](../02-architecture/search-strategy.md)), e.g., `?customers?search=main+street` |

## Allowed filter fields are explicit, per endpoint

Each endpoint documents its own supported filter fields in its module PRD's "API Requirements" section — filtering is never open-ended against arbitrary columns, both to keep query plans predictable (every filterable field has a supporting index — see [Indexes](../04-database/indexes.md)) and to avoid inadvertently exposing an internal-only column as filterable.

## Example: Jobs filterable fields

`status`, `priority`, `job_type_id`, `customer_id`, `property_id`, `assigned_user_id`, `created_at`, `scheduled_start` — see [Jobs PRD](../06-modules/jobs-prd.md).

## Tenant scoping is not a filter

`organization_id` is never a client-supplied filter parameter — it is always derived server-side from the authenticated session (see [Authentication](./authentication.md)) and enforced independently by Row Level Security (see [Multi-Tenancy](../04-database/multi-tenancy.md)). A request can never "filter into" another Organization's data by supplying a different `organization_id`.

## Invalid filter handling

An unsupported filter field or an invalid value for a known field (e.g., `status=not_a_real_status`) returns a `422` validation error (see [Errors](./errors.md)), not a silently ignored filter — silently ignoring an invalid filter risks a client believing a query is scoped when it isn't.

## Related documents

[API Overview](./api-overview.md) · [Pagination](./pagination.md) · [Sorting](./sorting.md) · [Search Strategy](../02-architecture/search-strategy.md)
