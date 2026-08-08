# Sprint 0: Project Setup

## Goal

Nothing customer-facing — get the team able to build, test, and deploy. The first line of application code should be written against a working pipeline, not before one exists.

## Deliverables

1. Monorepo scaffold: `apps/web`, `apps/worker`, `packages/db`, `packages/ui`, `packages/shared`, `packages/config` — per [Project Structure](../08-engineering/project-structure.md), even if most packages start nearly empty.
2. Supabase projects provisioned: Local (Docker), Preview (branching enabled), Staging, Production — per [Environment Management](../10-devops/environment-management.md).
3. Base Drizzle schema + first migration: empty but wired, confirming the migration pipeline works end to end (local → CI → Staging) per [Migrations](../04-database/migrations.md).
4. CI pipeline: lint, type-check, test (even with zero tests initially, the pipeline stage exists), Vercel Preview Deployment wired to PRs — per [CI/CD](../10-devops/ci-cd.md).
5. Base observability wired: Sentry project connected, Axiom log drain connected — per [ADR-021](../11-adr/ADR-021-observability.md).
6. `.env.example` and local development documented and verified by a teammate following it from scratch — per [Local Development](../10-devops/local-development.md).

## Exit criteria

A trivial change (e.g., a health-check endpoint) can go from a local commit through a PR, CI, Preview Deployment, merge, and Staging deployment without manual intervention.

## Related documents

[Phase 1: Foundation](./phase-1-foundation.md) · [Project Structure](../08-engineering/project-structure.md) · [CI/CD](../10-devops/ci-cd.md)
