# Request Validation

## Mechanism

Every route handler validates its request body/query parameters against a **Zod schema** before any business logic executes. The Zod schema is defined once per use case in the owning domain module and shared between the server route handler and, where applicable, the client-side form — see [Architecture Principles](../02-architecture/architecture-principles.md), [TypeScript Standards](../08-engineering/typescript-standards.md).

## Validation failure response

```http
POST /api/v1/jobs
Content-Type: application/json

{
  "customer_id": "not-a-uuid",
  "property_id": "01984f6e-1a2b-7c91-9e21-6a1f3d2b8c22"
}
```

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request body failed validation.",
    "details": [
      { "field": "customer_id", "issue": "Must be a valid UUID." },
      { "field": "job_type_id", "issue": "Required." }
    ]
  }
}
```
HTTP status `422`.

## What is validated

- **Shape and type**: required fields, correct primitive types, string length/format (e.g., email, phone, UUID).
- **Referential plausibility at the API layer**: e.g., `job_type_id` must be a syntactically valid UUID — but whether it actually exists and belongs to the caller's Organization is checked by the application/domain layer against the database (and ultimately enforced by the foreign key constraint — see [Foreign Keys](../04-database/foreign-keys.md)), not by Zod alone.
- **Business-rule shape**: e.g., an Estimate line item's `quantity` must be a positive number — mirroring the database `CHECK` constraint (see [Constraints](../04-database/constraints.md)) so invalid input is rejected with a clear message before it ever reaches the database.

## Output validation

Response payloads are also typed against Zod schemas (or inferred TypeScript types derived from them) in development/test builds, to catch a route handler accidentally leaking an unintended field (e.g., an internal cost field on a Customer-Portal-facing endpoint) before it ships — see [API Security](../07-security/api-security.md).

## Sanitization

Free-text fields (Job descriptions, notes) are stored as-is (not HTML-escaped at write time) and are escaped/sanitized at render time by React's default JSX escaping — Atlas does not store pre-sanitized/mutated user input, avoiding a class of double-escaping and data-fidelity bugs. Any field that will ever be rendered as raw HTML (none at launch) would require an explicit allowlist-based sanitizer, not default escaping — see [XSS Prevention](../07-security/api-security.md).

## Related documents

[Errors](./errors.md) · [Constraints](../04-database/constraints.md) · [TypeScript Standards](../08-engineering/typescript-standards.md) · [API Security](../07-security/api-security.md)
