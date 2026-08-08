# ADR-003: TypeScript (Strict Mode) Across the Stack

## Status

Accepted

## Date

2026-08-08

## Context

Atlas's domain model has significant structural complexity (state machines, tenant-scoped relationships, financial immutability rules — see [Domain Overview](../03-domain/domain-overview.md)) where type errors caught at compile time prevent an entire class of production bugs, particularly around the shape of data crossing the API boundary.

## Problem

Should Atlas's codebase be typed (and how strictly), or rely on JavaScript with runtime validation alone?

## Decision

TypeScript in `strict` mode (full strict flag set) across every package in the monorepo, with no `any` outside narrowly justified, explicitly commented exceptions. See [TypeScript Standards](../08-engineering/typescript-standards.md), [Coding Standards](../08-engineering/coding-standards.md).

## Alternatives Considered

1. **Plain JavaScript with JSDoc type hints** — rejected. Weaker enforcement (JSDoc types are advisory, not compiler-enforced) for a domain with this much state-machine and financial-integrity complexity.
2. **TypeScript in non-strict mode** — rejected. Non-strict mode permits implicit `any` and unchecked `null`/`undefined`, which defeats much of the value strict typing provides specifically for the tenant-scoping and financial-calculation code paths where a `null` slipping through is a real production risk (e.g., an unguarded `organization_id` access).
3. **Flow** — rejected. TypeScript has a substantially larger ecosystem, better editor tooling, and is Next.js's default/best-supported option.

## Consequences

- Every domain type (Job status, Estimate line item, Permission) is compiler-checked, and discriminated unions model state machines so invalid states are structurally unrepresentable — see [TypeScript Standards](../08-engineering/typescript-standards.md).
- Database types are generated from the Drizzle schema and API types from Zod schemas, giving one source of truth end-to-end rather than hand-maintained, driftable type definitions.
- Onboarding new engineers requires TypeScript proficiency; accepted given TypeScript's mainstream adoption.

## Risks

- Strict mode adds friction for genuinely dynamic/unknown-shape data (e.g., a third-party webhook payload before validation) — mitigated by typing such values `unknown` and requiring a Zod parse before use, rather than reaching for `any`.
- Type-checking adds to CI runtime — accepted as a worthwhile trade against the bug classes it prevents; monitored as part of CI pipeline performance.

## Migration / Rollback

Not applicable as a rollback scenario — TypeScript strict mode is enforced from the first commit of every package; there is no "loosen it later" path without deliberately reintroducing the exact risk class this decision exists to prevent.

## Related Decisions

[TypeScript Standards](../08-engineering/typescript-standards.md) · [ADR-002: Next.js](./ADR-002-nextjs.md) · [ADR-004: PostgreSQL](./ADR-004-postgresql.md)
