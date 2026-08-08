# API Testing

## Scope

The full HTTP request/response cycle for `/api/v1/` endpoints: request validation, authentication, authorization, response shape, error format — verified against the actual route handlers, using the same ephemeral test database as [Integration Testing](./integration-testing.md).

## What is tested here that isn't covered elsewhere

- **Response envelope and status code correctness** per [Resource Conventions](../05-api/resource-conventions.md) and [Errors](../05-api/errors.md) — e.g., a validation failure returns exactly the documented `422` shape, a cross-tenant lookup returns exactly `404` (never `403`).
- **Pagination/filtering/sorting behavior** per [Pagination](../05-api/pagination.md), [Filtering](../05-api/filtering.md), [Sorting](../05-api/sorting.md) — cursor stability, allowlisted-field rejection.
- **Idempotency** for endpoints requiring it (Payment capture — see [Payments PRD](../06-modules/payments-prd.md)): the same `Idempotency-Key` submitted twice produces one side effect.
- **Rate limiting** behavior at the documented thresholds (see [Rate Limiting](../05-api/rate-limiting.md)).

## Example (illustrative)

```typescript
describe('POST /api/v1/jobs/:id/complete', () => {
  it('returns 422 when a required Task is incomplete', async () => {
    const job = await factories.createJobWithRequiredIncompleteTask();
    const res = await apiClient.post(`/api/v1/jobs/${job.id}/complete`, {}, { as: technicianAssignedTo(job) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('returns 404, not 403, for a Job in another Organization', async () => {
    const otherOrgJob = await factories.createJob({ organizationId: otherOrg.id });
    const res = await apiClient.post(`/api/v1/jobs/${otherOrgJob.id}/complete`, {}, { as: someUser });

    expect(res.status).toBe(404);
  });
});
```

## Contract testing

Every documented endpoint in each module PRD's "API Requirements" section has a corresponding test asserting the request/response shapes match what's documented — a mismatch is treated as a bug in whichever side (code or docs) is wrong, per [Documentation Standards](../08-engineering/documentation-standards.md).

## Related documents

[Testing Strategy](./testing-strategy.md) · [API Overview](../05-api/api-overview.md) · [Errors](../05-api/errors.md) · [Integration Testing](./integration-testing.md)
