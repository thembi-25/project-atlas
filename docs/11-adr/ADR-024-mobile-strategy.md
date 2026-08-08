# ADR-024: Progressive Web App Over Native Mobile

## Status

Accepted

## Date

2026-08-08

## Context

Technicians are the primary users of Atlas's mobile experience, executing the majority of their workday through it (see [Mobile PRD](../06-modules/mobile-prd.md), [User Personas](../00-overview/user-personas.md)). Atlas needs to ship this experience quickly and keep it in sync with the rest of the platform without doubling engineering effort across a separate native codebase.

## Problem

Should Atlas build native iOS/Android apps, a responsive web app, or an installable Progressive Web App (PWA) for the Technician mobile experience?

## Decision

A **Progressive Web App (PWA)**, built from the same Next.js codebase as the staff web app and Customer Portal ([ADR-002](./ADR-002-nextjs.md)), installable to a device home screen, with offline-tolerant (not offline-sync) behavior for the Technician's daily job list. See [Mobile PRD](../06-modules/mobile-prd.md), [ADR-001](./ADR-001-monorepo.md).

## Alternatives Considered

1. **Separate native iOS/Android apps (Swift/Kotlin or React Native)** — rejected for launch. Would require a second (or, for React Native, partially-separate) codebase, doubling maintenance surface for UI logic that otherwise reuses the same API and much of the same component patterns as the web app — an unjustified cost for a small team at launch, per [Architecture Principles](../02-architecture/architecture-principles.md).
2. **A plain responsive web app with no installability/offline features** — rejected. Technicians need at-least-basic offline tolerance (poor field connectivity is a documented, real constraint — see [Product Principles](../00-overview/product-principles.md), principle 8) and an app-like, installable experience for daily field use; a bare responsive site under-serves this need.
3. **React Native (shared logic, still a distinct app shell)** — a credible middle ground; rejected in favor of a PWA specifically to keep one Next.js codebase and one deployment pipeline (see [Deployment Architecture](../02-architecture/deployment-architecture.md)) rather than introducing a second build/release process, given the PWA approach meets the documented offline-tolerance and one-handed-usability requirements without it.

## Consequences

- One codebase serves staff web, Customer Portal, and Technician mobile — see [Project Structure](../08-engineering/project-structure.md).
- No app-store review/release cycle to manage for routine updates — changes ship the same way as any other Atlas deploy (see [Deployment](../10-devops/deployment.md)).
- Some native-only capabilities (deeper background push reliability, certain device integrations) are not available — accepted as a launch-scope trade-off, with native app wrapper explicitly listed as a future reconsideration in [Mobile PRD](../06-modules/mobile-prd.md).

## Risks

- Web Push reliability on iOS (a comparatively newer platform capability there) may be less consistent than a native app's push notifications — monitored as part of [Notifications PRD](../06-modules/notifications-prd.md) delivery-failure tracking; if it proves materially unreliable for time-sensitive Dispatch notifications, this is a documented trigger for reconsidering this ADR.
- Offline tolerance (not full sync) means some actions remain blocked until reconnect (see [Mobile PRD](../06-modules/mobile-prd.md), Edge Cases) — an accepted, clearly-communicated limitation, not a native-app gap being silently under-delivered.

## Migration / Rollback

If native app capability is ever justified (per the triggers noted above), it is additive — a native shell wrapping the same underlying web experience and API, or a fuller React Native rebuild reusing the existing API and domain logic, not a replacement requiring the web/Portal experience to change.

## Related Decisions

[Mobile PRD](../06-modules/mobile-prd.md) · [ADR-002: Next.js](./ADR-002-nextjs.md) · [ADR-001: Monorepo](./ADR-001-monorepo.md)
