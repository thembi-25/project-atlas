# Project Structure

## Monorepo layout

```
atlas/
├── apps/
│   ├── web/                 # Next.js app (UI + /api/v1 route handlers, staff + portal surfaces)
│   └── worker/               # Background worker (pg-boss processor)
├── packages/
│   ├── modules/
│   │   ├── identity/         # users, memberships, roles, permissions
│   │   ├── organization/     # organizations, teams
│   │   ├── crm/               # customers, contacts
│   │   ├── properties/       # properties, buildings, rooms, assets
│   │   ├── jobs/               # jobs, tasks, scheduling, dispatch
│   │   ├── financials/       # estimates, invoices, payments
│   │   ├── inventory/         # inventory items, suppliers
│   │   ├── documents/
│   │   ├── notifications/
│   │   └── analytics/
│   ├── db/                    # Drizzle schema, migrations, generated types
│   ├── integrations/         # Stripe, Twilio, Resend, QuickBooks clients
│   ├── ui/                    # shared shadcn/ui-based component library
│   ├── shared/                 # cross-module primitives (money type, date utils, ID generation)
│   └── config/                 # shared eslint/tsconfig/tailwind config
├── e2e/                        # Playwright end-to-end specs
├── docs/                       # this documentation
└── turbo.json / pnpm-workspace.yaml
```

This mirrors [Component Architecture](../02-architecture/component-architecture.md) directly — each `packages/modules/*` directory is one domain module with its own internal layering.

## Inside a domain module (e.g., `packages/modules/jobs/`)

```
jobs/
├── domain/          # pure business logic: state machine, validation rules, no framework/DB imports
├── application/     # use cases: orchestrate domain + infrastructure (e.g., dispatchJob())
├── infrastructure/  # Drizzle queries scoped to this module's own tables
├── index.ts         # public interface — the only import surface other modules may use
└── *.test.ts        # colocated unit/integration tests
```

This directly implements the four-layer separation in [Architecture Principles](../02-architecture/architecture-principles.md): `domain/` is Domain, `application/` is Application, `infrastructure/` is Infrastructure. Presentation lives in `apps/web/app/`, consuming modules only through their `index.ts`.

## Inside `apps/web/`

```
web/
├── app/
│   ├── (staff)/            # staff-facing routes (dashboard, jobs, scheduling, ...)
│   ├── (portal)/           # Customer Portal routes — see Customer Portal PRD
│   ├── api/v1/              # REST API route handlers, one directory per resource
│   └── layout.tsx
├── components/               # presentation-only, app-specific components (not shared across apps)
└── middleware.ts             # auth/session handling, security headers
```

`(staff)` and `(portal)` are separate Next.js route groups specifically so the Customer Portal's distinct, more restrictive access pattern (see [Customer Portal PRD](../06-modules/customer-portal-prd.md)) is structurally, not just logically, separated from staff routes.

## Rule: no cross-module deep imports

`packages/modules/financials` may import `packages/modules/jobs`'s `index.ts`, never `packages/modules/jobs/infrastructure/*` directly — enforced by the import-boundary lint rule referenced in [Coding Standards](./coding-standards.md).

## Related documents

[Component Architecture](../02-architecture/component-architecture.md) · [Architecture Principles](../02-architecture/architecture-principles.md) · [TypeScript Standards](./typescript-standards.md)
