# Audit Events

## Purpose

An Audit Event is an immutable record of a state-changing action taken on tenant-owned data — who did what, to which entity, when, and what changed. Audit Events are the mechanism behind [Product Principles](../00-overview/product-principles.md) principle 6 ("every write is attributable and auditable") and are required for licensing/insurance/warranty dispute defensibility, not just internal debugging.

## Key attributes

- `organization_id`, `actor_user_id` (nullable — system-generated events, e.g., a scheduled Worker job, use a `null` actor with an `actor_type` of `system`), `actor_type` (`user`, `system`, `api_key`).
- `entity_type`, `entity_id` (what was changed).
- `action` (`create`, `update`, `delete`, `state_transition`).
- `diff` (jsonb — before/after values for changed fields; for `create`, `before` is null; for `delete`, `after` is null).
- `occurred_at`, `request_id`/`correlation_id` (ties the event back to the originating API request — see [Logging](../10-devops/logging.md)), `ip_address` (for staff-initiated actions).

## Relationships

- **References** the changed entity (`entity_type`/`entity_id`) polymorphically, similar in pattern to [Documents](./documents.md) but with stricter immutability guarantees.
- **References** the acting [User](./users.md), where applicable.

## Business rules

1. Audit Events are written **synchronously, in the same database transaction** as the change they record — never via the asynchronous event mechanism used for cross-module reactions (see [Event-Driven Architecture](../02-architecture/event-driven-architecture.md)) — because an eventually-consistent audit record defeats the purpose of an audit trail.
2. Audit Events are append-only: no `UPDATE` or `DELETE` is permitted on this table by any application role, enforced at the database layer (no `UPDATE`/`DELETE` grants on the table for the application's runtime role, only `INSERT`/`SELECT`). See [Audit Logging](../04-database/audit-logging.md).
3. Every entity mutation covered by [Acceptance Criteria](../01-product/acceptance-criteria.md) ("audit trail completeness") must produce exactly one Audit Event — not zero, not several — verified by integration tests per module.
4. Audit Events are retained for a minimum period defined in [Audit Logging](../04-database/audit-logging.md) (driven by financial/compliance record-keeping norms), independent of whether the underlying entity itself has since been soft-deleted.

## Data requirements

`audit_events` (`organization_id`, `actor_user_id`, `actor_type`, `entity_type`, `entity_id`, `action`, `diff` jsonb, `occurred_at`, `request_id`, `ip_address`) — partitioned by month for query performance and retention management at scale. See [Scalability Strategy](../02-architecture/scalability-strategy.md).

## API requirements

Read-only endpoint, filterable by entity/actor/date range, scoped to Roles with `audit:read` Permission (Owner/Admin, and Accountant for financial-entity audit trails). See [Audit Security](../07-security/audit-security.md).

## Permission requirements

Owner/Admin: full read. Accountant: read scoped to financial entities (Invoices, Payments, Estimates). No Role has write/delete access — Audit Events are system-generated only, never manually created or edited.

## Related documents

[Audit Logging](../04-database/audit-logging.md) · [Audit Security](../07-security/audit-security.md) · [Event-Driven Architecture](../02-architecture/event-driven-architecture.md) · [ADR-012: Audit Logging](../11-adr/ADR-012-audit-logging.md)
