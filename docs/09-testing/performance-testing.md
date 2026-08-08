# Performance Testing

## What is measured against [Non-Functional Requirements](../01-product/non-functional-requirements.md)

| Target (from NFRs) | How it's tested |
|---|---|
| API p95 < 400ms (reads) / 800ms (writes) under normal load | Load test (k6 or equivalent) against a Staging-equivalent environment with realistic data volume, run before each major release and after any change to a high-traffic query path |
| Scheduling board renders 50 Technicians/week in <2s | Playwright-based performance assertion (navigation timing) as part of the E2E suite for the Scheduling journey |
| Mobile job list/detail loads from cache in <500ms offline | Automated timing assertion in the mobile PWA's E2E suite, run with network throttled/disabled |
| Search results in <400ms | Load test against a seeded dataset of realistic size (thousands of Customers/Properties per Organization) — see [Search Strategy](../02-architecture/search-strategy.md) |

## Realistic data volume for testing

Performance tests run against a seeded dataset modeling the target scale from [Scalability Strategy](../02-architecture/scalability-strategy.md) (thousands of Organizations, hundreds of thousands of Jobs) — never against a near-empty database, since query plans and index effectiveness only become visible at realistic volume. A dedicated, refreshed performance-testing database (distinct from Staging) is maintained for this purpose.

## Query-level review

Any new query added to a high-traffic path (Jobs, Scheduling, Financials) requires an `EXPLAIN ANALYZE` review as part of code review, confirming index usage before merge — see [Indexes](../04-database/indexes.md), Index maintenance. This catches most performance regressions before they ever reach a load test.

## Database migration performance

Every migration is timed against the realistic-volume dataset in CI (see [Database Testing](./database-testing.md), Migration tests) — a migration that would lock a large table for an unacceptable duration in Production is caught here, not discovered during a Production deploy.

## Background job throughput

The [Background Worker](../02-architecture/container-architecture.md)'s `pg-boss` queue processing rate is monitored under simulated load (e.g., a burst of notification-sending jobs from a large multi-Job dispatch event) to confirm queue depth doesn't grow unbounded — see [ADR-016](../11-adr/ADR-016-background-jobs.md) for the scaling triggers this feeds into.

## When performance testing triggers an architecture reconsideration

A sustained, tuning-resistant performance shortfall (not a one-off regression fixable by an index) is the documented trigger for the infrastructure escalation paths in [Scalability Strategy](../02-architecture/scalability-strategy.md) (read replicas, partitioning) and [Caching Strategy](../02-architecture/caching-strategy.md) (introducing Redis) — performance test results are the evidence that justifies those otherwise-deferred infrastructure additions.

## Related documents

[Non-Functional Requirements](../01-product/non-functional-requirements.md) · [Scalability Strategy](../02-architecture/scalability-strategy.md) · [Indexes](../04-database/indexes.md) · [Monitoring](../10-devops/monitoring.md)
