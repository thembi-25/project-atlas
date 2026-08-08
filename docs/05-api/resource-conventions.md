# Resource Conventions

## URL structure

- Collections: plural nouns, `snake_case` where multi-word — `/api/v1/inventory_items`, `/api/v1/jobs`.
- Single resource: `/api/v1/{collection}/{id}` where `{id}` is the UUID primary key — never a display/natural key (`job_number`, `invoice_number`) — see [Primary Keys](../04-database/primary-keys.md).
- Nested sub-resources for genuine ownership relationships: `/api/v1/jobs/{id}/tasks`, `/api/v1/invoices/{id}/payments`, `/api/v1/properties/{id}/assets`.
- Non-CRUD actions as a sub-path verb on the resource, `POST` only: `/api/v1/jobs/{id}/dispatch`, `/api/v1/estimates/{id}/approve`, `/api/v1/invoices/{id}/finalize` — used specifically where a state-machine transition (see e.g. [Jobs](../03-domain/jobs.md), State Machine) needs its own validated endpoint rather than a generic field PATCH, per [Acceptance Criteria](../01-product/acceptance-criteria.md).

## HTTP methods

| Method | Use |
|---|---|
| `GET` | Read a collection or single resource; never mutates |
| `POST` | Create a resource, or invoke a state-transition action endpoint |
| `PATCH` | Partial update of a mutable resource (never used on immutable/finalized entities — see [Invoices](../03-domain/invoices.md)) |
| `DELETE` | Soft-delete, where applicable (see [Soft Deletion](../04-database/soft-deletion.md)) — never a hard delete via the API |

`PUT` is not used — Atlas standardizes on `PATCH` for partial updates since full-resource replacement is rarely the actual intent and increases accidental-overwrite risk.

## Response envelope

```json
{ "data": { ... } }
```
for single resources, and
```json
{ "data": [ ... ], "meta": { "next_cursor": "...", "has_more": true } }
```
for collections — see [Pagination](./pagination.md).

## Field naming

Response JSON keys mirror database column names (`snake_case`, see [Naming Conventions](../04-database/naming-conventions.md)) rather than being translated to `camelCase` — this keeps the API, the database schema, and this documentation using one consistent vocabulary end to end, reducing translation bugs between layers.

## Timestamps, money, IDs

- IDs: UUID strings.
- Timestamps: ISO 8601 UTC strings.
- Money: decimal strings (e.g., `"149.99"`), never floating-point JSON numbers — see [API Overview](./api-overview.md).

## Expansion of related resources

List/get endpoints do not expand nested relationships by default (to keep payloads predictable and cache-friendly); an explicit `?expand=customer,property` query parameter opts into inlining specific relations, documented per endpoint in each module's PRD "API Requirements" section.

## Related documents

[API Overview](./api-overview.md) · [Pagination](./pagination.md) · [Filtering](./filtering.md) · [Versioning](./versioning.md)
