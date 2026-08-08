# Backups

## Database backups

- **Automated daily full backups** plus **point-in-time recovery (PITR)** via Supabase's managed PostgreSQL backup capability, retained for a minimum of 30 days in Production.
- Backups are stored encrypted, in a separate storage location from the primary database, consistent with standard disaster-recovery separation-of-failure-domain practice.
- Backup restoration is **tested quarterly** (restore to a temporary, isolated environment and verify data integrity/application functionality against it) — an untested backup is not a reliable backup, and this is treated as a real recurring operational task, not a one-time setup checkbox.

## File storage backups

Supabase Storage's underlying object storage provides its own durability guarantees (S3-compatible, multi-copy by default); Atlas does not additionally hand-roll a separate file backup process for Documents (see [Documents](../03-domain/documents.md)) beyond what the Storage platform provides, consistent with [Architecture Principles](../02-architecture/architecture-principles.md) principle 4 (use platform capability before adding infrastructure).

## Backup retention vs. data retention policy

Backup retention (30 days rolling, for operational recovery) is distinct from the [Audit Logging](../04-database/audit-logging.md) retention policy (7 years for financial records) — a backup is for recovering from an operational incident (bad deploy, accidental mass-delete), not the mechanism by which long-term audit/compliance retention is satisfied; the latter is satisfied by the live, retained `audit_events` table and financial records themselves, not by reaching into a 30-day-old backup.

## What backups protect against

Accidental data loss (a bug causing unintended deletes/overwrites), Production incident requiring rollback to a known-good state, and — as a last-resort recovery path — a catastrophic infrastructure failure at the managed-platform level (mitigated primarily by Supabase's own infrastructure redundancy, with Atlas's backups as an independent safety net).

## What backups do NOT protect against

A logical/application-level bug that has been silently corrupting data for weeks before detection — PITR mitigates this within its retention window, but detection speed (via [Monitoring](./monitoring.md) and data-integrity checks) matters as much as backup retention length for this scenario.

## Restore procedure

Documented step by step in [Disaster Recovery](./disaster-recovery.md), including the specific decision criteria for choosing full-backup restore vs. point-in-time recovery vs. a targeted data-fix migration, depending on the nature of the incident.

## Related documents

[Disaster Recovery](./disaster-recovery.md) · [Audit Logging](../04-database/audit-logging.md) · [Monitoring](./monitoring.md)
