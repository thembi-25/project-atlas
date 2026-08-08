# ADR-002: Next.js as the Application Framework

## Status

Accepted

## Date

2026-08-08

## Context

Atlas needs a single framework serving three UI surfaces (staff web app, Customer Portal, Technician mobile experience — see [Mobile PRD](../06-modules/mobile-prd.md)) and the REST API (`/api/v1/`), per the API-first principle in [ADR-010](./ADR-010-api-first.md).

## Problem

Which web application framework should serve as the foundation for both the UI and the API layer, given a small team that needs to move quickly across frontend and backend concerns without context-switching between disparate stacks?

## Decision

Next.js (App Router) is the application framework, serving both the UI (React Server/Client Components) and the API (Route Handlers under `app/api/v1/`) from one codebase. See [Technology Stack](../02-architecture/technology-stack.md), [Architecture Overview](../02-architecture/architecture-overview.md).

## Alternatives Considered

1. **Separate frontend (React SPA) and backend (Express/Fastify/NestJS) codebases** — rejected. Doubles the deployment surface and requires maintaining two sets of tooling (build, lint, test) for a benefit (framework specialization) that doesn't outweigh the coordination cost for Atlas's team size and API-first design (which already keeps the API properly decoupled logically, per [ADR-010](./ADR-010-api-first.md), without needing physical separation).
2. **Remix** — a credible alternative with a similar full-stack React model; rejected in favor of Next.js primarily for its more mature ecosystem, first-class Vercel deployment story (see [Deployment Architecture](../02-architecture/deployment-architecture.md)), and broader team/hiring familiarity.
3. **A pure backend framework (NestJS) with a separate static frontend** — rejected for the same reasons as option 1, with the added downside of losing React Server Components' data-fetching ergonomics for the staff dashboard's data-dense views.

## Consequences

- UI and API ship together, versioned together, tested together — reduces coordination overhead.
- Server Components reduce client-side JavaScript for data-heavy staff dashboard views, benefiting the performance targets in [Non-Functional Requirements](../01-product/non-functional-requirements.md).
- The mobile experience is delivered as a responsive PWA from this same codebase rather than a separate native app — see [ADR-024](./ADR-024-mobile-strategy.md).
- The team commits to Next.js's App Router conventions and release cadence, including occasional framework-driven migration work when major versions ship breaking changes.

## Risks

- Vercel-specific deployment optimizations create a soft platform dependency (see [ADR-026](./ADR-026-deployment-strategy.md)) — mitigated by Next.js's standard Node.js output target remaining available if a platform change is ever needed.
- App Router is a comparatively newer paradigm than the older Pages Router; the team accepts a marginally smaller pool of existing examples/patterns in exchange for its Server Component and layout benefits.

## Migration / Rollback

Not a practically reversible decision short of a substantial rewrite; the risk is mitigated by the layered architecture in [Architecture Principles](../02-architecture/architecture-principles.md), which keeps Domain-layer business logic framework-independent — a future framework change would primarily affect the Presentation and Application layers, not the Domain layer's tested business rules.

## Related Decisions

[ADR-001: Monorepo](./ADR-001-monorepo.md) · [ADR-010: API-First](./ADR-010-api-first.md) · [ADR-024: Mobile Strategy](./ADR-024-mobile-strategy.md) · [ADR-026: Deployment Strategy](./ADR-026-deployment-strategy.md)
