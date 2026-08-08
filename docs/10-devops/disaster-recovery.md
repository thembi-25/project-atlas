# Disaster Recovery

## Recovery objectives

- **RPO (Recovery Point Objective)**: ≤ 5 minutes of data loss, achieved via Supabase's point-in-time recovery capability (see [Backups](./backups.md)).
- **RTO (Recovery Time Objective)**: ≤ 4 hours for a full-service restoration from a catastrophic scenario (e.g., accidental mass-deletion, corrupted migration) — most realistic incidents (a bad deploy, a single failing dependency) are expected to resolve far faster via rollback (see [Deployment](./deployment.md)), not a full DR restoration.

## Incident classes and response

| Scenario | Response |
|---|---|
| Bad application deploy | Vercel instant rollback (see [Deployment](./deployment.md)) — minutes, no data-layer action needed |
| Bad migration (schema issue, not data loss) | Forward-fix migration per [Migrations](../04-database/migrations.md); rollback of the *application* only, schema stays forward-compatible |
| Accidental mass data change/deletion (application bug) | Point-in-time recovery to just before the incident, restored to a temporary environment, affected rows identified and selectively repaired in Production via a reviewed, logged corrective migration — a full-database rollback is avoided where possible to prevent losing legitimate, unrelated writes that happened after the incident |
| Suspected security breach (leaked credential, RLS gap exploited) | Immediate credential rotation (see [Secrets Management](../07-security/secrets-management.md)), affected access window audited via [Audit Events](../03-domain/audit-events.md), affected Organizations notified per the incident communication plan below |
| Supabase/Vercel platform outage | No action available beyond monitoring the provider's status and communicating transparently with customers — Atlas does not maintain a redundant secondary platform at launch scale (see [Scalability Strategy](../02-architecture/scalability-strategy.md) for why multi-region/multi-platform redundancy is explicitly out of scope for the current roadmap horizon) |

## Incident communication

Any incident causing customer-visible downtime or a confirmed data-integrity issue is communicated to affected Organizations with: what happened, what data (if any) was affected, and what corrective action was taken — consistent with [Product Principles](../00-overview/product-principles.md) principle 9's transparency stance, applied to incidents as much as to routine data access.

## Practiced, not theoretical

The restore procedure is tested quarterly as part of the backup-testing cadence in [Backups](./backups.md); a tabletop security-incident exercise (see [Security Testing](../09-testing/security-testing.md)) is run before launch and periodically thereafter, so the first real execution of this plan is not the first time it's ever been attempted.

## Post-incident review

Every incident reaching this document's response tiers gets a written post-incident review: root cause, timeline, what worked, what to fix — feeding back into [Monitoring](./monitoring.md) (was the incident detected fast enough) and [Testing Strategy](../09-testing/testing-strategy.md) (should a test have caught this).

## Related documents

[Backups](./backups.md) · [Deployment](./deployment.md) · [Monitoring](./monitoring.md) · [Secrets Management](../07-security/secrets-management.md) · [Audit Events](../03-domain/audit-events.md)
