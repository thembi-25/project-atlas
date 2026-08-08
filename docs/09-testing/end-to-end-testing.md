# End-to-End Testing

## Scope

Full user journeys through the real UI, browser-driven via Playwright, against a Preview-equivalent environment (real Next.js app, real ephemeral Postgres, mocked third-party services — see below). This layer verifies that the layers below it are actually wired together correctly, not just individually correct.

## Golden paths covered (launch scope)

Directly mapped to [User Journeys](../00-overview/user-journeys.md):

1. **New customer inquiry to scheduled job** (Journey 1) — Dispatcher creates Customer/Property/Job, schedules, dispatches.
2. **Technician on-site execution** (Journey 2) — Technician completes checklist, creates/approves an Estimate, completes the Job, generates and pays an Invoice.
3. **Office reconciliation** (Journey 3) — Accountant views financial dashboard, exports data.
4. **Customer self-service** (Journey 4) — Portal Contact approves an Estimate and pays an Invoice.

Each is one Playwright spec exercising the full flow across multiple personas/sessions where applicable (e.g., Journey 2 requires both a Technician session and, for Portal approval steps, a separate Contact session).

## Third-party service handling in E2E

Stripe, Twilio, and Resend are called against their official sandbox/test modes (not fully mocked), so the E2E suite catches real integration drift (e.g., a Stripe API version change) that a mock would hide — see [Integration Architecture](../02-architecture/integration-architecture.md).

## What is explicitly NOT covered by E2E

Every permutation of every business rule (that's [Integration Testing](./integration-testing.md)'s job) — E2E covers the golden path plus a small number of critical failure paths (e.g., a declined payment) per journey, not exhaustive edge-case coverage, since E2E tests are the slowest and most brittle layer in the pyramid.

## Stability practices

- Tests select elements via accessible roles/labels, not brittle CSS selectors, so UI refactors don't break tests that don't care about markup structure.
- Each spec runs against a freshly seeded Organization (via the same factories used in integration tests, exposed through a test-only seeding endpoint disabled in Production) — no shared, mutable E2E fixture data that tests could interfere with each other over.
- Flaky tests are treated as bugs (in the test or the underlying feature) and fixed or quarantined with a tracked ticket — never silently retried into passing without investigation.

## CI execution

Runs on every PR against its Preview Deployment (see [Deployment Architecture](../02-architecture/deployment-architecture.md)) and again against Staging post-merge as a final gate before Production promotion — see [CI/CD](../10-devops/ci-cd.md).

## Related documents

[Testing Strategy](./testing-strategy.md) · [User Journeys](../00-overview/user-journeys.md) · [CI/CD](../10-devops/ci-cd.md) · [Deployment Architecture](../02-architecture/deployment-architecture.md)
