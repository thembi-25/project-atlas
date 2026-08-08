# ADR-001: Monorepo, Modular Monolith Architecture

## Status

Accepted

## Date

2026-08-08

## Context

Project Atlas needs an architecture that supports a small initial engineering team shipping Core Operations quickly, while not foreclosing the ability to scale the team, the codebase, and the infrastructure as the platform grows through the pillars described in [Vision](../00-overview/vision.md).

## Problem

Should Atlas be built as a single monolithic application, a set of independently deployed microservices, or something in between — and should the code live in one repository or many?

## Decision

Atlas is built as a **modular monolith** — one deployable Next.js application (plus one background worker) with strict internal module boundaries mirroring the domain model — inside a **single monorepo** (pnpm workspaces + Turborepo). See [Architecture Overview](../02-architecture/architecture-overview.md), [Component Architecture](../02-architecture/component-architecture.md), [Project Structure](../08-engineering/project-structure.md).

## Alternatives Considered

1. **Microservices from day one** — rejected. Adds operational complexity (service discovery, distributed transactions, network latency between what would otherwise be simple function calls) with no corresponding benefit at Atlas's launch scale, and directly contradicts the anti-overengineering mandate in [Architecture Principles](../02-architecture/architecture-principles.md).
2. **Multiple repositories (polyrepo)** per module — rejected. Increases cross-module change coordination cost (a single feature touching Jobs and Financials would require coordinated multi-repo PRs and versioning) for a team small enough that a monorepo's simplicity wins.
3. **Unstructured monolith (no enforced module boundaries)** — rejected. Would degrade into a ball of mud as the domain grows across Phases 1–7, and would make the future extraction option (see Consequences) practically impossible.

## Consequences

- One CI pipeline, one deployment cadence to reason about (see [CI/CD](../10-devops/ci-cd.md)).
- Cross-module refactors are straightforward (atomic PRs, shared tooling).
- Module boundaries must be actively enforced (lint rules — see [Coding Standards](../08-engineering/coding-standards.md)) or they will erode over time without the natural boundary a separate repository/service would impose.
- A future module extraction into an independent service (if Jobs or Notifications ever need independent scaling) is possible without a data-model rewrite, because module ownership boundaries already exist — see [Scalability Strategy](../02-architecture/scalability-strategy.md).

## Risks

- Team growth could strain a single-repository workflow (build times, PR contention) before Atlas reaches the scale that would justify splitting — mitigated by Turborepo's incremental build/caching and by the module-boundary discipline making any future split mechanical rather than a redesign.
- Module boundary discipline requires ongoing enforcement (lint rules, code review vigilance) — a lapse here is the most likely way this decision quietly fails.

## Migration / Rollback

Splitting into multiple repositories or services later is additive (extract one module at a time, starting with the one under the most independent scaling pressure) rather than requiring a full rewrite, precisely because the module boundaries already exist. No rollback is needed for the monorepo choice itself; it can be revisited per-module as scale demands.

## Related Decisions

[ADR-002: Next.js](./ADR-002-nextjs.md) · [ADR-009: Domain Modules](./ADR-009-domain-modules.md) · [Architecture Principles](../02-architecture/architecture-principles.md)
