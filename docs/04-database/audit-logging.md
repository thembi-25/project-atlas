# Audit Logging

## Purpose

Database-layer detail supporting [Audit Events](../03-domain/audit-events.md). This document specifies how the `audit_events` table is actually populated, secured, and retained.

## Population mechanism

Audit Events are written by a **generic trigger function** attached to every tenant-owned table (`AFTER INSERT OR UPDATE OR DELETE`), not by scattered application-code calls that could be forgotten on a new code path. The trigger:

1. Computes a `diff` (jsonb) of changed columns (`OLD` vs `NEW` for updates; full row for insert/delete).
2. Resolves the acting `user_id` from the current Postgres session's request-scoped setting (`SET LOCAL app.current_user_id`, set by the application at the start of every request transaction).
3. Inserts one row into `audit_events` within the same transaction as the triggering change.

This trigger-based approach is deliberate: it guarantees that *any* write to a covered table is audited, including writes from a future code path a developer forgets to instrument manually, and including any direct database access during incident response. See [ADR-012: Audit Logging](../11-adr/ADR-012-audit-logging.md) for alternatives considered (application-only logging was rejected for exactly this completeness gap).

## Security

- The application's runtime Postgres role has `INSERT`/`SELECT` on `audit_events` but **no `UPDATE`/`DELETE` grant at all** — not even for Owner/Admin-level application logic, since a genuinely immutable audit trail must not be alterable by any application code path, however privileged.
- Only a separate, break-glass administrative database role (used solely for the rare, logged retention-purge operation described below) has any further privilege on this table, and that role is not accessible to the application's normal runtime.

## Retention

- Minimum retention: **7 years** for audit records tied to financial entities (Invoices, Payments, Estimates), matching typical U.S. small-business financial record-keeping norms.
- Minimum retention: **3 years** for operational entities (Jobs, Scheduling, Dispatch) not tied to a financial transaction.
- Retention is enforced by policy and a documented, logged purge process (not automatic deletion baked into application code) — see [Backups](../10-devops/backups.md) for how this interacts with backup retention.

## Partitioning

`audit_events` is partitioned by month (`occurred_at`) from the first migration that creates it, since it is the highest-volume append-only table in the system and partition pruning keeps both write performance and time-range query performance stable as history accumulates. See [Scalability Strategy](../02-architecture/scalability-strategy.md).

## What is captured vs. what is not

- Captured: full `diff` of business-data columns.
- Not captured in the `diff` itself: raw payment card data (never present in the database at all — see [Payments](../03-domain/payments.md)), and any column explicitly flagged as sensitive in [Data Protection](../07-security/data-protection.md) is redacted in the `diff` (value replaced with a `[REDACTED]` marker) while still recording that the field changed.

## Related documents

[Audit Events](../03-domain/audit-events.md) · [Audit Security](../07-security/audit-security.md) · [ADR-012](../11-adr/ADR-012-audit-logging.md) · [Constraints](./constraints.md)
