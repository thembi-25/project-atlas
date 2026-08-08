# ADR-026: Vercel + Supabase Deployment Strategy

## Status

Accepted

## Date

2026-08-08

## Context

Having chosen Next.js ([ADR-002](./ADR-002-nextjs.md)) and Supabase ([ADR-005](./ADR-005-supabase.md)), Atlas needs a deployment/hosting strategy for the application, background worker, and database across Preview/Staging/Production environments.

## Problem

Should Atlas self-manage its own hosting infrastructure (e.g., on raw AWS/GCP), or use platform-native managed hosting for its chosen frameworks?

## Decision

**Vercel** hosts the Next.js application (with automatic Preview Deployments per PR); **Supabase** hosts PostgreSQL/Auth/Storage (with database branching for Preview environments); a small persistent Node process on **Render or Fly.io** hosts the Background Worker. See [Deployment Architecture](../02-architecture/deployment-architecture.md).

## Alternatives Considered

1. **Self-managed infrastructure on raw AWS/GCP (EC2/ECS, RDS, custom CI/CD)** — rejected per [Architecture Principles](../02-architecture/architecture-principles.md), principle 4: significant operational overhead (infrastructure-as-code, scaling configuration, security patching) for a team that benefits far more from managed platforms at this stage, with no product-differentiation value in owning that infrastructure.
2. **A single all-in-one platform (e.g., Railway or Render for everything, including the Next.js app)** — rejected. Vercel's Next.js-specific optimizations (edge network, automatic Preview Deployments tightly integrated with the framework — see [ADR-002](./ADR-002-nextjs.md)) are meaningfully better than a generic platform's Next.js support, justifying using Vercel specifically for the app while still using a lighter-weight platform (Render/Fly.io) for the one component (the Worker) that doesn't fit Vercel's serverless model.
3. **AWS Lambda + API Gateway directly** — rejected as a more manual, less integrated version of what Vercel already provides purpose-built for Next.js.

## Consequences

- Deployment is largely "git push" simple for the common case (see [CI/CD](../10-devops/ci-cd.md), [Deployment](../10-devops/deployment.md)) — no infrastructure-as-code to maintain for the app or database layers.
- Preview environments (Vercel + Supabase database branching, combined) are cheap and automatic, materially improving PR review quality (see [Pull Request Process](../08-engineering/pull-request-process.md)).
- The Worker's separate hosting (Render/Fly.io) is the one piece of infrastructure the team manages somewhat more directly, since `pg-boss` requires a persistent process incompatible with Vercel's serverless model — see [ADR-016](./ADR-016-background-jobs.md).

## Risks

- Two-and-a-half platform vendors (Vercel, Supabase, Render/Fly.io) to coordinate deployments across — mitigated by the CI/CD pipeline (see [CI/CD](../10-devops/ci-cd.md)) treating them as one coordinated release process, not independently-triggered deploys.
- Vercel/Supabase-specific lock-in for deployment mechanics (though not for the underlying code/data, per [ADR-002](./ADR-002-nextjs.md) and [ADR-005](./ADR-005-supabase.md), which remain portable) — accepted given the operational leverage gained.

## Migration / Rollback

The application code (standard Next.js) and database (standard PostgreSQL) remain portable to alternative hosting per [ADR-002](./ADR-002-nextjs.md) and [ADR-005](./ADR-005-supabase.md); migrating deployment platforms would be an infrastructure project, not an application rewrite.

## Related Decisions

[Deployment Architecture](../02-architecture/deployment-architecture.md) · [ADR-002: Next.js](./ADR-002-nextjs.md) · [ADR-005: Supabase](./ADR-005-supabase.md) · [ADR-016: Background Jobs](./ADR-016-background-jobs.md)
