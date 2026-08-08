# API Instructions

## Before adding/changing an endpoint

Check the relevant module PRD's "API Requirements" section (section 11 — see [`06-modules/`](../06-modules/)) for the documented endpoint contract. If the endpoint isn't documented there yet, document it first (in the same PR), then implement — the PRD is the contract, not a description written after the fact.

## Follow the established conventions exactly

- URL structure and HTTP method usage: [Resource Conventions](../05-api/resource-conventions.md).
- Request validation via Zod, matching [Request Validation](../05-api/request-validation.md).
- Pagination (cursor-based), filtering, sorting: [Pagination](../05-api/pagination.md), [Filtering](../05-api/filtering.md), [Sorting](../05-api/sorting.md).
- Error response shape and status codes: [Errors](../05-api/errors.md) — including the `404`-not-`403` rule for cross-tenant resource access.
- Authentication/authorization: [Authentication](../05-api/authentication.md), [Authorization](../05-api/authorization.md) — every endpoint checks Permissions server-side; never trust a client-supplied Role/Organization claim.

## State-transition endpoints

Entity status changes (Job dispatch, Estimate approval, Invoice finalization) are dedicated `POST` action endpoints (`/resource/{id}/{action}`), never a generic `PATCH` on the `status` field — see [Resource Conventions](../05-api/resource-conventions.md) and the relevant entity's state machine in [`03-domain/`](../03-domain/).

## Idempotency

Any endpoint with a real-world side effect that a client might retry (payment capture, invoice finalization) requires an `Idempotency-Key` and must be implemented so a duplicate request produces one side effect — see [Payments](../03-domain/payments.md), [ADR-018](../11-adr/ADR-018-payments.md).

## Output shape discipline

Never return a field not explicitly part of the documented response shape — particularly on Customer Portal-facing endpoints (`/api/v1/portal/*`), where internal-only fields (cost data, staff notes) must never leak. Verify with output validation in test builds per [Request Validation](../05-api/request-validation.md).

## Testing requirement

Every new/changed endpoint needs corresponding tests per [API Testing](../09-testing/api-testing.md): success path, validation failure, permission denial (both wrong-Role and cross-tenant), and any documented error/edge case from the PRD's sections 16–17.

## Related documents

[API Overview](../05-api/api-overview.md) · [Authorization](../05-api/authorization.md) · [API Testing](../09-testing/api-testing.md) · [Implementation Rules](./implementation-rules.md)
