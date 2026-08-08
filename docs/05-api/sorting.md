# Sorting

## Convention

```http
GET /api/v1/jobs?sort=-created_at
GET /api/v1/invoices?sort=due_date,-total
```

- A comma-separated list of fields; a leading `-` means descending, no prefix means ascending.
- Multiple sort fields are applied in the given order, left to right.

## Default sort

Every collection endpoint has a documented default sort (typically `-created_at`, most-recent-first) applied when no `sort` parameter is given, so results are deterministic and pagination cursors (see [Pagination](./pagination.md)) are stable by default.

## Allowed sort fields are explicit, per endpoint

Like filtering, sortable fields are an explicit, documented allowlist per endpoint (in each module PRD's "API Requirements" section), each backed by a supporting index for the specific sort — see [Indexes](../04-database/indexes.md). Sorting on a non-indexed, non-allowlisted field is rejected with a `422` rather than silently executed (which could produce an unacceptably slow, full-table-scanning query on a large Organization's data).

## Sort stability and pagination

Every sort implicitly appends `id` as a final tiebreaker (even if the client's `sort` parameter doesn't mention it), guaranteeing a stable, non-ambiguous row order for cursor construction — see [Pagination](./pagination.md), Cursor construction.

## Example: Jobs sortable fields

`created_at`, `scheduled_start`, `priority`, `status`, `job_number` — see [Jobs PRD](../06-modules/jobs-prd.md).

## Related documents

[API Overview](./api-overview.md) · [Pagination](./pagination.md) · [Filtering](./filtering.md)
