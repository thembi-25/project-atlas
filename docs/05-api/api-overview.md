# API Overview

## Style

REST, JSON over HTTPS, versioned at `/api/v1/`. The API is not an afterthought wrapper around the UI — the first-party Next.js web app consumes this same API, per [ADR-010: API-First](../11-adr/ADR-010-api-first.md) and [Architecture Principles](../02-architecture/architecture-principles.md).

## Base URL and versioning

`https://app.atlas.example/api/v1/` (production domain is a placeholder — see [Open Questions](../DOCUMENTATION-CONSISTENCY-REPORT.md)). See [Versioning](./versioning.md) for the policy on introducing `/api/v2/`.

## Resource-oriented endpoints

Endpoints map to the [Domain Model](../03-domain/domain-overview.md) nouns: `/api/v1/customers`, `/api/v1/properties`, `/api/v1/jobs`, `/api/v1/jobs/{id}/tasks`, `/api/v1/invoices/{id}/payments`. See [Resource Conventions](./resource-conventions.md).

## Request/response format

- All request and response bodies are `application/json`, UTF-8.
- All timestamps are ISO 8601 in UTC (`2026-08-08T14:30:00Z`).
- All monetary amounts are strings representing decimal values (e.g., `"149.99"`), never floating-point numbers, to avoid precision loss — matching the `numeric(12,2)` database representation (see [Naming Conventions](../04-database/naming-conventions.md)).
- All list endpoints return cursor-paginated envelopes — see [Pagination](./pagination.md).

## Example: creating a Job

**Request**
```http
POST /api/v1/jobs
Authorization: Bearer <session-jwt>
Content-Type: application/json

{
  "job_type_id": "01984f6e-2b3a-7c91-9e21-6a1f3d2b8c40",
  "customer_id": "01984f6e-1a2b-7c91-9e21-6a1f3d2b8c11",
  "property_id": "01984f6e-1a2b-7c91-9e21-6a1f3d2b8c22",
  "priority": "normal",
  "description": "AC not cooling, customer reports warm air from vents"
}
```

**Response `201 Created`**
```json
{
  "data": {
    "id": "01984f6e-9c1a-7c91-9e21-6a1f3d2b8c99",
    "job_number": "J-2026-0417",
    "status": "draft",
    "job_type_id": "01984f6e-2b3a-7c91-9e21-6a1f3d2b8c40",
    "customer_id": "01984f6e-1a2b-7c91-9e21-6a1f3d2b8c11",
    "property_id": "01984f6e-1a2b-7c91-9e21-6a1f3d2b8c22",
    "priority": "normal",
    "description": "AC not cooling, customer reports warm air from vents",
    "created_at": "2026-08-08T14:30:00Z",
    "updated_at": "2026-08-08T14:30:00Z"
  }
}
```

Every successful response wraps its payload in a `data` key (or `data` + `meta` for lists — see [Pagination](./pagination.md)); every error response uses the shape defined in [Errors](./errors.md).

## Idempotency

Write operations with real-world side effects that could be retried by a flaky client (payment capture, invoice finalization) require an `Idempotency-Key` header. See [Payments](../03-domain/payments.md), [ADR-018](../11-adr/ADR-018-payments.md).

## Cross-cutting conventions (see their own documents)

[Authentication](./authentication.md) · [Authorization](./authorization.md) · [Resource Conventions](./resource-conventions.md) · [Request Validation](./request-validation.md) · [Pagination](./pagination.md) · [Filtering](./filtering.md) · [Sorting](./sorting.md) · [Errors](./errors.md) · [Rate Limiting](./rate-limiting.md) · [Versioning](./versioning.md) · [Webhooks](./webhooks.md) · [Integrations](./integrations.md)

## Data export

Consistent with [Product Principles](../00-overview/product-principles.md) principle 9, every resource collection endpoint supports full pagination through to completion (no hidden result caps) so an Organization can always export its complete data through the same API a third-party integration would use.
