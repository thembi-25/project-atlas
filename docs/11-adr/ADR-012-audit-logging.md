# ADR-012: Trigger-Based, Synchronous Audit Logging

## Status

Accepted

## Date

2026-08-08

## Context

Atlas needs a defensible, complete audit trail of every state-changing action on tenant data, for both licensing/compliance and internal trust reasons (see [Product Principles](../00-overview/product-principles.md), principle 6). An audit log that can be incomplete (missing a write path) or delayed (eventually consistent) fails its purpose for compliance and dispute-resolution use cases.

## Problem

Should audit logging be implemented by application code explicitly calling a "log this" function at each relevant point, or by a database-level mechanism that captures every write automatically — and should it be synchronous or asynchronous?

## Decision

**Database triggers** on every tenant-owned table write `audit_events` rows **synchronously, within the same transaction** as the change — not via the asynchronous domain-event mechanism in [ADR-011](./ADR-011-event-history.md), and not via scattered application-code logging calls. See [Audit Logging](../04-database/audit-logging.md).

## Alternatives Considered

1. **Application-code-only logging** (each service function calls `logAuditEvent(...)`) — rejected. Requires every current and future write path to remember to call it — a single forgotten call anywhere (including a future developer's new code, or a direct database script during an incident) silently produces an incomplete audit trail, unacceptable for a compliance-relevant system.
2. **Asynchronous audit logging** (via the domain-event/Worker mechanism from [ADR-011](./ADR-011-event-history.md)) — rejected. An audit record that might not exist yet (queued but not yet processed) at the moment someone needs to verify "what happened" defeats the purpose; audit completeness must be guaranteed at write time, not eventually.
3. **A third-party audit-logging/compliance SaaS product** — rejected. Unjustified additional vendor/infrastructure dependency for a need Postgres triggers solve directly and more cheaply, per [Architecture Principles](../02-architecture/architecture-principles.md) principle 4.

## Consequences

- Audit completeness is structurally guaranteed — any write to a covered table produces an Audit Event, regardless of which application code path performed it (including a hypothetical direct database script during an incident, which is exactly the scenario where audit trail matters most).
- `audit_events` has no `UPDATE`/`DELETE` grant for the application's runtime role — see [Audit Security](../07-security/audit-security.md) — making the trail tamper-resistant, not just complete.
- Trigger logic adds marginal write-path overhead, monitored as part of [Performance Testing](../09-testing/performance-testing.md).

## Risks

- Trigger-based logic is less visible in application code than an explicit function call, which could make it easier to overlook during a schema review — mitigated by the mandatory "does this migration include RLS and audit coverage" checklist item in [Migrations](../04-database/migrations.md).
- High-volume tables generate a correspondingly high volume of Audit Events — addressed by partitioning `audit_events` by month from its first migration (see [Audit Logging](../04-database/audit-logging.md)).

## Migration / Rollback

Not applicable — this is a foundational compliance/trust guarantee, not a reversible implementation detail. A future change to the underlying mechanism (e.g., adopting a specialized audit-log storage engine) would preserve the synchronous, trigger-based *guarantee*, only changing where the resulting record is stored.

## Related Decisions

[Audit Events](../03-domain/audit-events.md) · [Audit Logging](../04-database/audit-logging.md) · [Audit Security](../07-security/audit-security.md) · [ADR-011: Event History](./ADR-011-event-history.md)
