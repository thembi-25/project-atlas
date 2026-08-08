# ADR-010: API-First Architecture

## Status

Accepted

## Date

2026-08-08

## Context

Atlas's roadmap includes future third-party and partner integration surfaces (Marketplace, Manufacturer partners — see [Roadmap Phases 4–5](../13-roadmap/implementation-roadmap.md)) that will need a well-defined API. Building a private, UI-optimized RPC layer first and retrofitting a public API later is a common source of awkward, UI-shaped APIs that don't serve third-party needs well.

## Problem

Should the first-party Next.js web app talk to its backend via an ad hoc, UI-optimized internal mechanism, or via the same well-defined, versioned REST API that any future external consumer would use?

## Decision

The first-party web app (staff, Customer Portal, mobile PWA) consumes the same versioned `/api/v1/` REST API documented in [`05-api/`](../05-api/) that any future third-party integration would use — there is no private, UI-only backend channel. See [API Overview](../05-api/api-overview.md).

## Alternatives Considered

1. **Next.js Server Actions / RPC-style internal calls, with a separate public API built later** — rejected. Historically leads to a public API that's an afterthought, poorly shaped for external consumers, and requires significant rework once third-party integration actually matters (Phase 4+). Building the real API first, and having the first-party app "eat its own dog food," ensures the API is genuinely usable from day one.
2. **GraphQL as the API layer** — rejected; see [Architecture Principles](../02-architecture/architecture-principles.md) and the explicit anti-overengineering mandate against GraphQL absent a specific justified need (Atlas's access patterns are well-served by REST's resource-oriented model, and GraphQL's flexibility benefits are not needed for a bounded, well-understood domain).

## Consequences

- Every module's PRD documents its "API Requirements" as real, reviewed API surface, not an internal implementation detail — see [`06-modules/`](../06-modules/).
- The API's conventions (pagination, filtering, errors — see [`05-api/`](../05-api/)) are battle-tested by real, high-volume first-party traffic before any external party ever calls them.
- Some UI-specific convenience (e.g., a single request returning several related resources bundled for one screen) requires either a documented `?expand=` parameter (see [Resource Conventions](../05-api/resource-conventions.md)) or a dedicated, still-versioned endpoint — never an undocumented shortcut.

## Risks

- Slightly more upfront design discipline required for every endpoint (must be genuinely resource-oriented, not just "whatever this one screen needs") — accepted as the cost of avoiding a costly later API redesign.

## Migration / Rollback

Not applicable — this is a discipline/process decision rather than an infrastructure choice; there's no migration required to "undo" it, only a risk of discipline eroding over time, mitigated by the architecture principle being explicitly documented and enforced in code review (see [Code Review](../08-engineering/code-review.md)).

## Related Decisions

[API Overview](../05-api/api-overview.md) · [ADR-002: Next.js](./ADR-002-nextjs.md) · [ADR-023: API Versioning](./ADR-023-api-versioning.md) · [Integrations](../05-api/integrations.md)
