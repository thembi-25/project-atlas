# ADR-016: Postgres-Backed Background Jobs (`pg-boss`)

## Status

Accepted

## Date

2026-08-08

## Context

Several operations must not block an HTTP response (notification delivery, PDF generation, QuickBooks sync — see [Integration Architecture](../02-architecture/integration-architecture.md)) or run on a schedule (Analytics materialized-view refresh, Warranty-expiring alerts). Atlas needs a reliable job queue for these.

## Problem

Should Atlas use a dedicated message broker/queue service (SQS, Kafka, RabbitMQ, a hosted job-queue SaaS), or a Postgres-native queuing library?

## Decision

**`pg-boss`**, a PostgreSQL-backed job queue library, running inside a small, persistent Node.js Worker process (`apps/worker`), deployed separately from the serverless Next.js app. See [Container Architecture](../02-architecture/container-architecture.md), [ADR-011: Event History](./ADR-011-event-history.md).

## Alternatives Considered

1. **A managed message broker (AWS SQS, Google Cloud Tasks)** — rejected per [Architecture Principles](../02-architecture/architecture-principles.md), principle 4: adds a new infrastructure dependency and vendor relationship for a need Postgres already meets. Also complicates the transactional-outbox guarantee (see [ADR-011](./ADR-011-event-history.md)) since an external queue can't participate in the same database transaction as the triggering write.
2. **Kafka/RabbitMQ** — rejected outright as disproportionate infrastructure for Atlas's job volume, explicitly named as something to avoid in [Architecture Principles](../02-architecture/architecture-principles.md).
3. **A third-party job-scheduling SaaS (e.g., Trigger.dev, Inngest)** — a credible, lighter-weight alternative; rejected in favor of `pg-boss` specifically for the transactional-outbox guarantee (jobs enqueue atomically with the triggering database write, since they live in the same Postgres instance) and to avoid an additional vendor dependency for a need already met by the existing database.
4. **Serverless-only, cron-triggered functions with no persistent queue** — rejected for anything requiring immediate, reliable, ordered processing (e.g., a `job.completed` event that must reliably trigger Invoice generation) — a cron-poll model alone doesn't cleanly capture "process this specific enqueued item promptly and exactly-once-effectively."

## Consequences

- The Worker is a separate deployable artifact (see [Container Architecture](../02-architecture/container-architecture.md)) requiring its own hosting (a small persistent Node process on Render/Fly.io, since `pg-boss` needs a long-running process, not a serverless function).
- Job enqueue and the triggering business-logic write happen in the same database transaction, guaranteeing a job is never lost due to enqueue succeeding while the triggering write fails, or vice versa.
- Job consumers must be written idempotently, since `pg-boss` (like any real-world queue) provides at-least-once delivery.
- Retry/backoff and dead-letter handling are `pg-boss`-native features, not custom-built.

## Risks

- `pg-boss` throughput is bounded by a single Postgres instance's capacity, shared with operational query load — monitored via queue-depth metrics (see [Monitoring](../10-devops/monitoring.md)) with documented triggers (sustained queue depth growth) for scaling Worker concurrency or, if truly necessary at a much larger future scale, reconsidering this decision.
- Running a persistent Worker process is a small but real deviation from the otherwise fully-serverless Vercel deployment model — accepted as necessary and isolated to this one component.

## Migration / Rollback

If job volume ever outgrows a Postgres-backed queue, the Worker's job-consumption interface can be swapped for a message-broker-based consumer without changing how producer modules enqueue work (the same "write event, enqueue job" call pattern), isolating the migration to the Worker's internals.

## Related Decisions

[ADR-011: Event History](./ADR-011-event-history.md) · [Container Architecture](../02-architecture/container-architecture.md) · [ADR-026: Deployment Strategy](./ADR-026-deployment-strategy.md) · [Scalability Strategy](../02-architecture/scalability-strategy.md)
