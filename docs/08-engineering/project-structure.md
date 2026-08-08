# Project Structure

## Status: reflects the actual Sprint 0 (Engineering Foundation) implementation

This document originally described an aspirational layout authored before any code existed. As of Sprint 0, real packages exist with real (if still mostly empty) content, and this document has been updated to match what was actually built — see [`docs/13-roadmap/SPRINT-0-COMPLETION-REPORT.md`](../13-roadmap/SPRINT-0-COMPLETION-REPORT.md), "Deviations From Architecture," for the specific naming differences from the pre-Sprint-0 version of this document and why they were accepted (package-naming/grouping is an implementation detail, not an architecture decision — see [Documentation Standards](./documentation-standards.md), "When to write a new ADR vs. update an existing document").

## Monorepo layout

```
project-atlas/
├── apps/
│   ├── web/                  # Next.js app (UI + /api/v1 route handlers, staff + portal surfaces)
│   └── worker/                # Background worker (pg-boss processor)
├── packages/
│   ├── config/                 # shared tsconfig/eslint base + typed env schema (@atlas/config)
│   ├── database/               # Drizzle schema, migrations, typed client (@atlas/database)
│   ├── ui/                     # shared shadcn/ui-based component library (@atlas/ui)
│   ├── auth/                   # Supabase Auth client foundation only — no RBAC (@atlas/auth)
│   ├── crm/                    # customers, contacts — EMPTY until Sprint 2 (@atlas/crm)
│   ├── properties/             # properties, buildings, rooms — EMPTY until Sprint 3 (@atlas/properties)
│   ├── assets/                 # installed equipment, warranties — EMPTY until Sprint 3 (@atlas/assets)
│   ├── jobs/                   # jobs, tasks — EMPTY until Sprint 4 (@atlas/jobs)
│   ├── scheduling/             # scheduling, dispatch — EMPTY until Sprint 4 (@atlas/scheduling)
│   ├── inventory/              # inventory items — EMPTY until Sprint 6 (@atlas/inventory)
│   ├── suppliers/              # suppliers — EMPTY until Sprint 6 (@atlas/suppliers)
│   ├── marketplace/            # EMPTY until Strategic Phase 3 (@atlas/marketplace)
│   └── analytics/              # EMPTY until Sprint 7 (@atlas/analytics)
├── scripts/                    # local setup verification, etc.
├── infrastructure/             # placeholder — see infrastructure/README.md
├── .github/workflows/          # CI (see docs/10-devops/ci-cd.md)
├── docs/                       # this documentation
└── turbo.json / pnpm-workspace.yaml / package.json
```

## Differences from the pre-Sprint-0 aspirational layout

| Then (pre-Sprint-0) | Now (as built) | Why |
|---|---|---|
| `packages/modules/<name>/` (nested) | `packages/<name>/` (flat) | Matches the Sprint 0 task's explicit package list; a flat layout is simpler for a small package count and is trivially revisited if the module count grows large enough to warrant grouping. |
| `packages/db/` | `packages/database/` | Naming preference from the Sprint 0 task; no functional difference. |
| `packages/modules/identity/`, `packages/modules/organization/` | Not yet created; `packages/auth/` covers only Supabase Auth client wiring | Identity/Organization domain logic (Memberships, Roles, Permissions — see [Identity PRD](../06-modules/identity-prd.md)) is Sprint 1 scope. Sprint 0 deliberately does not implement it. Whether it becomes `packages/identity` (new) or extends `packages/auth` is a Sprint 1 planning decision, not resolved here. |
| `packages/modules/financials/`, `packages/modules/documents/`, `packages/modules/notifications/` | Not yet created | Not in the Sprint 0 task's package list; these are created when their owning sprint begins (Sprint 5 for financials; Documents/Notifications alongside the sprints that produce them — see [`docs/13-roadmap/ROADMAP-DECISION.md`](../13-roadmap/ROADMAP-DECISION.md), Section C.1). |
| `packages/shared/`, `packages/integrations/` | Not yet created | No cross-module primitive or third-party integration client exists yet to justify them — created on first real need, not speculatively (see [Coding Standards](./coding-standards.md) on avoiding premature abstraction). |
| `e2e/` (Playwright) | Not yet created | No user-facing flow exists yet to write an E2E spec against — see [End-to-End Testing](../09-testing/end-to-end-testing.md). |

## Inside a still-empty module package (e.g., `packages/crm/`)

```
crm/
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── vitest.config.ts
└── src/
    ├── index.ts       # placeholder — documents what will live here and when
    └── index.test.ts  # smoke test confirming the package is valid/importable
```

Once a package's owning sprint begins, it grows the same internal layering described below for `apps/web` and any future domain module: `domain/` (pure business logic), `application/` (use cases), `infrastructure/` (Drizzle queries scoped to that module's own tables), with `index.ts` remaining the only import surface other packages may use — see [Architecture Principles](../02-architecture/architecture-principles.md).

## Inside `apps/web/`

```
web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # Sprint 0 foundation page only — no product screens yet
│   ├── globals.css
│   └── api/v1/
│       └── health/route.ts   # the only endpoint that exists as of Sprint 0
├── lib/
│   ├── env.ts                 # typed, memoized environment access
│   ├── logger.ts               # structured JSON logger
│   ├── errors.ts                # typed AppError hierarchy + API error shape
│   └── request-id.ts            # X-Request-Id resolution
├── middleware.ts                 # security headers + request-ID propagation (no auth session handling yet — Sprint 1)
├── tailwind.config.ts / components.json   # shadcn/ui foundation
└── vitest.config.ts
```

`(staff)` and `(portal)` route groups (for the Customer Portal's structurally separate access pattern — see [Customer Portal PRD](../06-modules/customer-portal-prd.md)) do not exist yet; they are introduced when the modules that need them are built, per [`docs/13-roadmap/ROADMAP-DECISION.md`](../13-roadmap/ROADMAP-DECISION.md).

## Rule: no cross-package deep imports

A package may import another package's `index.ts` (its declared public interface via the `exports` field in `package.json`), never reach into another package's `src/` internals directly. This rule is enforced by code review discipline as of Sprint 0; an automated import-boundary lint rule is a candidate addition once there are enough real cross-module imports to make automating it worthwhile (see [Coding Standards](./coding-standards.md) on the general preference for real usage over speculative tooling).

## Related documents

[Component Architecture](../02-architecture/component-architecture.md) · [Architecture Principles](../02-architecture/architecture-principles.md) · [TypeScript Standards](./typescript-standards.md) · [`docs/13-roadmap/SPRINT-0-COMPLETION-REPORT.md`](../13-roadmap/SPRINT-0-COMPLETION-REPORT.md)
