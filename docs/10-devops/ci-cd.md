# CI/CD

## Pipeline (GitHub Actions)

Every pull request triggers, in parallel where possible:

1. **Lint** (ESLint) and **type-check** (`tsc --noEmit`) across all workspace packages.
2. **Unit + integration tests** (Vitest, against an ephemeral Postgres instance spun up in the CI runner) — see [Testing Strategy](../09-testing/testing-strategy.md).
3. **Migration safety check**: applies any new migration to a copy of the realistic-volume performance-testing dataset (see [Performance Testing](../09-testing/performance-testing.md)) and asserts it completes within an acceptable duration and doesn't hold a long-lived table lock.
4. **Dependency vulnerability scan** (see [Dependency Management](../08-engineering/dependency-management.md)).
5. **Build** (`next build`) to catch build-time errors before merge.

On success, Vercel automatically creates a **Preview Deployment** against a fresh ephemeral Supabase database branch (migrated + dev-seeded).

6. **End-to-end tests** (Playwright, see [End-to-End Testing](../09-testing/end-to-end-testing.md)) run against the Preview Deployment.

## Merge to `main`

On merge, the pipeline deploys to **Staging**: runs pending migrations against the Staging Supabase project, deploys the Next.js app and Worker, then re-runs the E2E suite against Staging as a final automated gate before Production is eligible for promotion.

## Promotion to Production

Deliberate, manual trigger (not automatic on merge) given the financial/multi-tenant stakes — see [Deployment](./deployment.md). Requires: Staging E2E green, no open Sentry error-rate spike on Staging, and an explicit approval from an engineer with Production deploy access.

## Branch protection

`main` requires: all CI checks passing, at least one approving review, branch up to date with `main` — see [Pull Request Process](../08-engineering/pull-request-process.md).

## Secrets in CI

CI-runner secrets (test third-party API keys, ephemeral database credentials) are scoped to CI only, distinct from any real environment's secrets, and are themselves subject to the same no-logging discipline as [Secrets Management](../07-security/secrets-management.md).

## Pipeline observability

A failed CI run notifies the PR author directly (GitHub check status); a failed Staging deployment or Staging E2E run alerts the on-call engineer (see [Monitoring](./monitoring.md)), since a broken Staging blocks the next Production promotion for everyone.

## Related documents

[Deployment](./deployment.md) · [Deployment Architecture](../02-architecture/deployment-architecture.md) · [Migrations](../04-database/migrations.md) · [Testing Strategy](../09-testing/testing-strategy.md)
