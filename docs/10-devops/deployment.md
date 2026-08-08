# Deployment

## Deployment units

Two independently deployed artifacts from one monorepo, always deployed together for a given environment (never mismatched schema-expectations between them) — see [Container Architecture](../02-architecture/container-architecture.md):

1. **Next.js app** (`apps/web`) → Vercel.
2. **Background Worker** (`apps/worker`) → a small persistent Node process on Render/Fly.io.

## Production promotion process

1. Staging has passed its full CI/E2E gate (see [CI/CD](./ci-cd.md)).
2. An engineer with Production access reviews the Staging-validated changeset (the diff between currently-live Production and the candidate) and triggers promotion.
3. Database migrations (if any) run against Production **first**, following the additive-first, backward-compatible discipline in [Migrations](../04-database/migrations.md) — the currently-running Production app version must remain functional against the new schema for the brief window before the new app version deploys.
4. The Next.js app and Worker deploy to Production, in that order (Worker last, so any Worker-side schema/event-shape expectations are guaranteed to match what the just-deployed app is now producing).

## Rollback

Vercel's instant rollback reverts the app to the previous deployment in seconds. Because migrations are additive-first and backward-compatible for at least one release (see [Migrations](../04-database/migrations.md)), a rolled-back app version continues to function correctly against the (not rolled back) current schema — schema rollback is never required as part of an application rollback.

## Deployment windows

No hard restriction on deployment timing (small-team, continuous-deployment-capable operation), but a deploy carrying a schema migration or touching payment/auth code is not initiated immediately before a period with no engineer available to respond to an issue.

## Zero-downtime requirement

Vercel's deployment model (new deployment fully provisioned and health-checked before traffic cutover) provides zero-downtime deploys for the Next.js app by default; the Worker's deployment briefly drains in-flight jobs before restart rather than dropping them mid-processing (`pg-boss` jobs are safely re-picked-up by the new Worker instance on restart since they're tracked durably in Postgres — see [ADR-016](../11-adr/ADR-016-background-jobs.md)).

## Post-deployment verification

Automated: Sentry error-rate monitoring for a spike immediately post-deploy (see [Monitoring](./monitoring.md)); a smoke-test E2E run against Production for the highest-criticality golden path (Job creation → completion → invoice → payment) confirms the live system is genuinely healthy, not just "deployed without error."

## Related documents

[CI/CD](./ci-cd.md) · [Database Deployment](./database-deployment.md) · [Deployment Architecture](../02-architecture/deployment-architecture.md) · [Disaster Recovery](./disaster-recovery.md)
