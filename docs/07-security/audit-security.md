# Audit Security

## Purpose

Security-specific detail on the [Audit Events](../03-domain/audit-events.md)/[Audit Logging](../04-database/audit-logging.md) system: how it resists tampering and who can read it.

## Tamper resistance

1. **No `UPDATE`/`DELETE` privilege exists on `audit_events` for the application's runtime database role** — this is a Postgres `GRANT` restriction, not merely an application-level rule that could be bypassed by a bug or a direct database connection using the normal application credentials. See [Audit Logging](../04-database/audit-logging.md).
2. **Population is trigger-based, not application-call-based** — a developer cannot accidentally ship a new write path that skips auditing, since the trigger fires on the underlying table write itself, not on a specific application function being remembered and called. See [Audit Logging](../04-database/audit-logging.md).
3. **Audit Events reference, but do not depend on, the continued existence of, their actor** — a removed User's historical Audit Events remain intact (`actor_user_id` set to `NULL` with `actor_type` preserved) per [Foreign Keys](../04-database/foreign-keys.md).

## Read access control

- Owner/Admin: full read access to their Organization's Audit Events.
- Accountant: read access scoped to financial entities (Invoices, Payments, Estimates) — not, for example, other staff's Role changes.
- No Role has write access — Audit Events are exclusively system-generated.
- Cross-Organization Audit Event access is impossible by the same RLS mechanism as every other tenant-owned table — see [Tenant Isolation](./tenant-isolation.md).

## What Audit Events must never contain

Raw payment card data (never present anywhere in Atlas — see [Data Protection](./data-protection.md)); unredacted values for fields flagged sensitive in [Data Protection](./data-protection.md) classification (the `diff` records that a sensitive field changed, with the value itself redacted).

## Audit trail as an incident-response tool

During a security investigation, Audit Events are the primary evidence source for "what happened, by whom, when" — this is why synchronous, same-transaction writing (see [Event-Driven Architecture](../02-architecture/event-driven-architecture.md)) is non-negotiable: an eventually-consistent or best-effort audit log would be unusable as investigative evidence for exactly the incidents it matters most for.

## Break-glass access

The rare, logged administrative operations that do have elevated privilege on `audit_events` (e.g., a compliance-driven retention purge — see [Audit Logging](../04-database/audit-logging.md), Retention) use a separate database role, never accessible from the application's normal runtime, and every such use is itself logged outside the table it operates on (in infrastructure-level audit logging — see [Monitoring](../10-devops/monitoring.md)).

## Related documents

[Audit Events](../03-domain/audit-events.md) · [Audit Logging](../04-database/audit-logging.md) · [Tenant Isolation](./tenant-isolation.md) · [ADR-012](../11-adr/ADR-012-audit-logging.md)
