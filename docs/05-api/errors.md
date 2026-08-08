# Errors

## Standard error envelope

Every non-2xx response uses this shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable, safe-to-display summary.",
    "details": [ { "field": "customer_id", "issue": "Required." } ]
  }
}
```

`details` is present only for errors that have per-field detail (primarily `validation_error`); it is omitted otherwise.

## Status code and `code` catalog

| HTTP status | `code` | Meaning |
|---|---|---|
| `400` | `bad_request` | Malformed request (e.g., invalid JSON body) |
| `401` | `unauthenticated` | No valid session |
| `403` | `forbidden` | Authenticated, but the caller's Role lacks the required Permission |
| `404` | `not_found` | Resource doesn't exist, or exists in a different Organization (see [Authorization](./authorization.md)) |
| `409` | `conflict` | State-machine violation (e.g., attempting to complete an already-cancelled Job — see [Jobs](../03-domain/jobs.md)) or a unique-constraint violation |
| `422` | `validation_error` | Request body/query failed schema or business-rule validation |
| `429` | `rate_limited` | See [Rate Limiting](./rate-limiting.md) |
| `500` | `internal_error` | Unexpected server error — message is always generic; no stack trace or internal detail is ever returned to the client |
| `503` | `service_unavailable` | A required downstream dependency (e.g., Stripe) is unavailable; the response indicates whether the operation is safe to retry |

## Example: state machine violation

```http
POST /api/v1/jobs/{id}/complete
```
where the Job is already `cancelled`:

```json
{
  "error": {
    "code": "conflict",
    "message": "This job cannot be completed because it has already been cancelled."
  }
}
```
HTTP status `409`.

## Principles

1. **Never leak internal detail.** `500` responses never include stack traces, SQL error text, or file paths — those are captured server-side in [Logging](../10-devops/logging.md)/Sentry, correlated by a `request_id` returned in every response (see below), never in the client-facing body.
2. **Never leak cross-tenant existence.** As established in [Authorization](./authorization.md), a resource in another Organization returns `404`, never `403` or a message implying it exists.
3. **Every response carries a `request_id`** (as a response header, `X-Request-Id`), correlating client-reported issues with server logs without exposing internal detail in the body itself.
4. **Validation error messages are specific enough to fix the request** without being specific enough to reveal internal schema/implementation detail beyond what the API contract itself already documents.

## Related documents

[Request Validation](./request-validation.md) · [Authorization](./authorization.md) · [Logging](../10-devops/logging.md) · [Rate Limiting](./rate-limiting.md)
