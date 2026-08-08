# Testing Strategy

## Testing pyramid

| Layer | Tool | What it covers | Volume |
|---|---|---|---|
| Unit | Vitest | Domain logic (state machines, pricing math, validation rules), pure functions | Largest — fast, isolated |
| Integration | Vitest + test database | Application-layer use cases against a real (ephemeral) Postgres instance, including RLS | Substantial — the layer most Atlas-specific bugs live in |
| API | Vitest + Next.js route handler test harness | Full request/response cycle: validation, auth, permissions, error shapes | Moderate — one to a few per endpoint |
| End-to-end | Playwright | Full user journeys through the real UI against a Preview-equivalent environment | Smallest — the critical golden paths only |

This shape is deliberate: Atlas's highest-value, highest-bug-density layer is the integration layer (business rules + RLS interacting with real Postgres), so it gets proportionally more investment than a typical web app might put there — see [Database Testing](./database-testing.md).

## What must be tested for every module

Per the PRD template's sections 18–19 (Acceptance Criteria, Testing Requirements — see [`06-modules/`](../06-modules/)):
1. Every functional requirement has at least one passing automated test (see [Functional Requirements](../01-product/functional-requirements.md)).
2. Every state machine transition (valid and invalid) is tested.
3. Every Role's Permission boundary is tested (can/cannot access).
4. Every documented error case and edge case is tested.
5. Tenant isolation is tested for every new tenant-owned table (see [Database Testing](./database-testing.md)).

## CI gate

No PR merges with failing tests; no PR merges with reduced coverage on a file it touches (coverage thresholds enforced per package, not just globally, so a well-tested module doesn't mask a poorly-tested one). See [CI/CD](../10-devops/ci-cd.md).

## Test data

Tests use factory functions (not fixtures copy-pasted per test) to construct valid domain entities, colocated with each module — e.g., `packages/modules/jobs/test-factories.ts` — so a schema change updates test data construction in one place. Test databases are seeded fresh per test run (see [Database Testing](./database-testing.md)), never sharing state with Staging/Production data.

## Non-negotiable test coverage (release-blocking)

Per [Acceptance Criteria](../01-product/acceptance-criteria.md): tenant isolation, financial immutability, and audit-trail-completeness tests must pass for any release — these are treated as a distinct, always-run suite regardless of what else changed in a given PR.

## Related documents

[Unit Testing](./unit-testing.md) · [Integration Testing](./integration-testing.md) · [API Testing](./api-testing.md) · [End-to-End Testing](./end-to-end-testing.md) · [Database Testing](./database-testing.md) · [Security Testing](./security-testing.md) · [Performance Testing](./performance-testing.md) · [Definition of Done](../12-claude/definition-of-done.md)
