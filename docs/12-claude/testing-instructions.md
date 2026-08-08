# Testing Instructions

## No behavior change without a corresponding test change

A PR that changes behavior without adding/updating a test is incomplete, per [Pull Request Process](../08-engineering/pull-request-process.md) — this applies to bug fixes as much as new features (a bug fix needs a regression test proving the bug is actually fixed).

## Match the testing pyramid

- Pure business logic (state machine validity, pricing math) → unit test — see [Unit Testing](../09-testing/unit-testing.md).
- Anything touching the database (RLS, constraints, cross-module orchestration) → integration test — see [Integration Testing](../09-testing/integration-testing.md).
- A new/changed API endpoint → API test covering success, validation failure, and permission denial — see [API Testing](../09-testing/api-testing.md).
- A new end-to-end user journey (rare — most work extends an existing journey) → Playwright spec, only for genuinely golden-path flows — see [End-to-End Testing](../09-testing/end-to-end-testing.md).

## Mandatory coverage for specific change types

| Change type | Required tests |
|---|---|
| New tenant-owned table | Cross-tenant isolation test (Organization A cannot access Organization B's rows) — see [Database Testing](../09-testing/database-testing.md) |
| New state machine transition | Both the valid transition and at least one invalid-transition-rejected case |
| New/changed Permission boundary | A test proving the disallowed Role is rejected, and the allowed Role(s) succeed |
| New state-changing operation | A test asserting exactly one [Audit Event](../03-domain/audit-events.md) is produced |
| New financial operation | Immutability/idempotency tests where applicable — see [Security Testing](../09-testing/security-testing.md) |

## Test data

Use the established factory functions (see [Testing Strategy](../09-testing/testing-strategy.md)) — do not hand-construct raw database rows bypassing domain validation in a test, since that can mask real validation bugs.

## Before declaring a task complete

Run the full relevant test suite locally (not just the new tests) to confirm no regression, per [Definition of Done](./definition-of-done.md). Report which tests were run and their outcome as part of the task summary.

## Related documents

[Testing Strategy](../09-testing/testing-strategy.md) · [Database Testing](../09-testing/database-testing.md) · [Security Testing](../09-testing/security-testing.md) · [Definition of Done](./definition-of-done.md)
