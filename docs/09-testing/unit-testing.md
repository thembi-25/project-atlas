# Unit Testing

## Scope

Pure Domain-layer logic with no database or network dependency: state machine transition validity, pricing/total calculations (Estimate/Invoice line-item math), business-rule predicates (e.g., "can this Job be completed given its Tasks' state"), Zod schema validation behavior.

## Tooling

Vitest, run in watch mode locally and once per CI run. No real database, no mocked HTTP — true unit isolation.

## What is (and isn't) unit-tested

- **Is**: `canTransitionJobStatus(current, target)`, `calculateInvoiceTotal(lineItems)`, `isWarrantyActive(warranty, now)`.
- **Isn't**: anything requiring a database round-trip (that's [Integration Testing](./integration-testing.md)) or an HTTP request/response (that's [API Testing](./api-testing.md)).

## Example (illustrative, not literal implementation)

```typescript
describe('Job state machine', () => {
  it('allows scheduled -> dispatched', () => {
    expect(canTransitionJobStatus('scheduled', 'dispatched')).toBe(true);
  });

  it('rejects completed -> scheduled (terminal state)', () => {
    expect(canTransitionJobStatus('completed', 'scheduled')).toBe(false);
  });
});
```

## Coverage expectation

Domain-layer code (`packages/modules/*/domain/`) targets high coverage (≥90% line coverage) since it is pure, fast to test, and carries the business-rule risk documented in each module's PRD "Business Rules" section — a domain-layer function without a corresponding unit test is treated as a review-blocking gap.

## What unit tests must NOT do

Mock the database or an external API and assert against the mock's behavior — that produces a test that passes even when the real integration is broken, which is why such coverage belongs to [Integration Testing](./integration-testing.md) against a real ephemeral Postgres instance instead.

## Related documents

[Testing Strategy](./testing-strategy.md) · [Integration Testing](./integration-testing.md) · [Coding Standards](../08-engineering/coding-standards.md)
