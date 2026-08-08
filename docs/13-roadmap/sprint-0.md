# Sprint 0: Engineering Foundation

> Part of Technical Implementation Phase 1 ([Phase 1: Foundation](./phase-1-foundation.md)). See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md), Section C, for how this sprint fits into the full Sprint 0–7 MVP sequence. Next: [Sprint 1](./sprint-1.md).
>
> **Status: Partial — see [SPRINT-0-COMPLETION-REPORT.md](./SPRINT-0-COMPLETION-REPORT.md).** The engineering foundation (monorepo, CI, testing, linting, environment validation, logging, error handling) is built and verified. Live Supabase/PostgreSQL connectivity is not yet verified — no Docker daemon or provisioned Supabase project was available in the environment that implemented this sprint. A human must resolve this before Sprint 1's first migration.

## Goal

Nothing customer-facing — get the team able to build, test, and deploy. The first line of application code should be written against a working pipeline, not before one exists.

## Deliverables

1. Monorepo scaffold: `apps/web`, `apps/worker`, `packages/database`, `packages/ui`, `packages/config` (plus `packages/auth` and 10 empty domain-module scaffolds — see [Project Structure](../08-engineering/project-structure.md) for the full, as-built list and naming rationale), even if most packages start nearly empty.
2. Supabase projects provisioned: Local (Docker), Preview (branching enabled), Staging, Production — per [Environment Management](../10-devops/environment-management.md).
3. Base Drizzle schema + first migration: empty but wired, confirming the migration pipeline works end to end (local → CI → Staging) per [Migrations](../04-database/migrations.md).
4. CI pipeline: lint, type-check, test (even with zero tests initially, the pipeline stage exists), Vercel Preview Deployment wired to PRs — per [CI/CD](../10-devops/ci-cd.md).
5. Base observability wired: Sentry project connected, Axiom log drain connected — per [ADR-021](../11-adr/ADR-021-observability.md).
6. `.env.example` and local development documented and verified by a teammate following it from scratch — per [Local Development](../10-devops/local-development.md).

## Exit criteria

A trivial change (e.g., a health-check endpoint) can go from a local commit through a PR, CI, Preview Deployment, merge, and Staging deployment without manual intervention.

## Related documents

[SPRINT-0-COMPLETION-REPORT.md](./SPRINT-0-COMPLETION-REPORT.md) · [ROADMAP-DECISION.md](./ROADMAP-DECISION.md) · [Phase 1: Foundation](./phase-1-foundation.md) · [Project Structure](../08-engineering/project-structure.md) · [CI/CD](../10-devops/ci-cd.md) · [Sprint 1](./sprint-1.md)
