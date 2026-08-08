# ADR-023: URL Path-Based API Versioning

## Status

Accepted

## Date

2026-08-08

## Context

Atlas's API ([ADR-010](./ADR-010-api-first.md)) will eventually be consumed by third parties and partners (Marketplace, Manufacturer integrations — see later Roadmap Phases), who need a stable contract and a clear, predictable path for breaking changes.

## Problem

How should Atlas signal and manage breaking API changes over time — URL path versioning, header-based versioning, or no formal versioning?

## Decision

**URL path versioning**: `/api/v1/`, with a whole-surface version bump (`/api/v2/`) reserved for breaking changes, and a minimum 12-month parallel-support/deprecation window once external consumers exist. See [Versioning](../05-api/versioning.md).

## Alternatives Considered

1. **Header-based versioning** (e.g., an `API-Version` request header) — rejected. Less discoverable/explicit for integrators (a URL is visible in every log line, every browser dev-tools request, every piece of documentation, whereas a header is easy to overlook), and no clear benefit for Atlas's use case outweighs that discoverability cost.
2. **No formal versioning (evolve the API in place, best-effort backward compatibility)** — rejected. Acceptable for a purely first-party-consumed API, but Atlas's roadmap explicitly anticipates third-party/partner consumers (see [ADR-010](./ADR-010-api-first.md)) who need a real contract and a real deprecation process, not best-effort compatibility.
3. **Per-resource versioning** (`/api/v1/jobs` and `/api/v2/customers` independently) — rejected as adding unnecessary mental-model complexity for integrators; a whole-surface version is simpler to reason about, at the accepted cost of occasionally bumping the whole surface for a change affecting only one resource.

## Consequences

- Every module PRD's "API Requirements" section documents endpoints under the current `/api/v1/` path.
- Additive, backward-compatible changes (new fields, new endpoints) never require a version bump — see [Versioning](../05-api/versioning.md) for the specific dividing line.
- A future `/api/v2/` is a deliberate, rare event, not a routine occurrence — API design discipline (see [Resource Conventions](../05-api/resource-conventions.md)) aims to keep most evolution additive.

## Risks

- Whole-surface versioning means an unrelated resource's breaking change could theoretically force integrators to migrate resources they don't care about — mitigated by keeping `/v2/` bumps rare and by the deprecation window giving ample migration time.

## Migration / Rollback

Not applicable in the traditional sense — the versioning *scheme* itself (path-based) is foundational; the actual version number increments as breaking changes genuinely require them, following the policy in [Versioning](../05-api/versioning.md).

## Related Decisions

[Versioning](../05-api/versioning.md) · [ADR-010: API-First](./ADR-010-api-first.md) · [Resource Conventions](../05-api/resource-conventions.md)
