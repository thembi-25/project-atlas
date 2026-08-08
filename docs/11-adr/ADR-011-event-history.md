# ADR-011: Internal Domain Events, Not Event Sourcing or a Message Broker

## Status

Accepted

## Date

2026-08-08

## Context

Several cross-module reactions in Atlas's domain (Job completion triggering Invoice generation and a Customer notification — see [Jobs](../03-domain/jobs.md)) benefit from decoupling: the `jobs` module shouldn't need to know how invoicing or notifications work internally. At the same time, Atlas is a modular monolith (see [ADR-001](./ADR-001-monorepo.md)), not a distributed system, and must not accidentally acquire distributed-systems complexity it doesn't need.

## Problem

How should cross-module reactions be implemented: direct synchronous calls between modules, full event sourcing as the persistence model, a message broker (Kafka/RabbitMQ/SQS), or something else?

## Decision

A **narrow, Postgres-native internal domain event mechanism**: modules write events to a `domain_events` table within the same transaction as their state change, and a transactional-outbox pattern enqueues Worker-processed jobs (via `pg-boss`) for asynchronous consumers — never a message broker, and never as a replacement for the relational tables as the source of truth. See [Event-Driven Architecture](../02-architecture/event-driven-architecture.md).

## Alternatives Considered

1. **Full event sourcing** (entity state derived by replaying an event log) — rejected. Massively increases query complexity (every read needs event replay or a maintained projection) for a domain where straightforward relational tables with clear current-state columns (Job `status`, Invoice `total`) are simpler, more debuggable, and sufficient — event sourcing solves problems (temporal queries, replay-based debugging) Atlas doesn't have at this scale.
2. **A message broker (Kafka, RabbitMQ, SQS)** — rejected per [Architecture Principles](../02-architecture/architecture-principles.md), principle 4: adds a new infrastructure dependency and operational surface for a need Postgres's own transactional guarantees and `pg-boss` queue already satisfy at Atlas's scale.
3. **Direct synchronous cross-module function calls** (e.g., `jobs` module directly calling `financials.generateInvoice()` and `notifications.send()` inline) — rejected as the *general* pattern, though used in narrow cases where genuine synchronous coupling is correct (e.g., checking Permission before an action). Direct calls would create tight coupling between modules and make it hard to add a new reaction (e.g., a future Analytics consumer of `job.completed`) without modifying the `jobs` module itself.

## Consequences

- Cross-module reactions are declared once (the event) and consumed by any number of interested modules without modifying the producer.
- Event delivery is guaranteed at-least-once via the transactional outbox pattern — an event is never silently lost because its enqueue is atomic with the state change that produced it.
- Consumers must be idempotent (a redelivered event must not double-process) — see [ADR-016: Background Jobs](./ADR-016-background-jobs.md).
- This is explicitly not a general-purpose pub/sub system — the event catalog is small, deliberate, and documented (see [Event-Driven Architecture](../02-architecture/event-driven-architecture.md#event-catalog-launch-scope)), not an open-ended mechanism modules can use for anything.

## Risks

- As the event catalog grows across future phases, the temptation to use it as a catch-all decoupling mechanism (rather than direct calls where synchronous coupling is actually simpler and correct) needs active discipline — mitigated by requiring a stated reason (need for async processing or genuine multi-consumer fan-out) before adding a new event type.

## Migration / Rollback

If a specific reaction chain ever needs true distributed messaging (e.g., after a module extraction under real scale pressure — see [Scalability Strategy](../02-architecture/scalability-strategy.md)), the event-producing side of this pattern (write-then-enqueue) is straightforwardly replaceable with a message-broker publish, without changing how producer modules emit events — the migration is isolated to the delivery mechanism, not the event-producing code.

## Related Decisions

[Event-Driven Architecture](../02-architecture/event-driven-architecture.md) · [ADR-012: Audit Logging](./ADR-012-audit-logging.md) · [ADR-016: Background Jobs](./ADR-016-background-jobs.md)
