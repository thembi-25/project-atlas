# Pagination

## Style: cursor-based

All collection endpoints use cursor pagination, not offset/page-number pagination — offset pagination degrades in both correctness (rows shifting between pages as data changes) and performance (large `OFFSET` values scan and discard rows) at the volumes Atlas targets (see [Non-Functional Requirements](../01-product/non-functional-requirements.md)).

## Request

```http
GET /api/v1/jobs?status=scheduled&limit=25&cursor=eyJpZCI6IjAxOTg0ZjZlLTk...
```

- `limit`: page size, default `25`, max `100`.
- `cursor`: opaque, base64-encoded token representing the last-seen row's sort position; omitted for the first page.

## Response

```json
{
  "data": [ { "...": "job objects" } ],
  "meta": {
    "next_cursor": "eyJpZCI6IjAxOTg0ZjZlLTk4...",
    "has_more": true
  }
}
```

When `has_more` is `false`, `next_cursor` is `null`.

## Cursor construction

The cursor encodes the sort column's value and the row's `id` (as a tiebreaker) for the currently active sort (see [Sorting](./sorting.md)), so pagination remains stable even when the sort column has duplicate values — e.g., paginating Jobs by `created_at` where multiple Jobs share the same timestamp.

## Consistency guarantee

Cursor pagination guarantees no row is skipped or duplicated across pages **as of the time each page was fetched**, for rows that existed at fetch time — it does not guarantee a fully frozen snapshot across the whole pagination sequence if the underlying data changes between page fetches (e.g., a new Job created after page 1 was fetched may or may not appear depending on its sort position). This is an accepted, standard trade-off for cursor pagination and matches user expectation for live operational data.

## Default and maximum limits

Every collection endpoint defaults to `limit=25` and caps at `limit=100` to protect both database and client-rendering performance; there is no "fetch all" parameter — a full export uses [full pagination through to completion](./api-overview.md#data-export), not a bypass of the page-size cap.

## Related documents

[API Overview](./api-overview.md) · [Filtering](./filtering.md) · [Sorting](./sorting.md)
