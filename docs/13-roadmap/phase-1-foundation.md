# Phase 1: Foundation

> **Technical Implementation Phase 1 of 7 — Engineering Foundation.** Implements: *prerequisite only; no Strategic Product Phase of its own.* See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md) for the authoritative distinction between Strategic Product Phases, Technical Implementation Phases, and Sprints — do not read "Phase 1" here as a product pillar.

## Goal

Stand up the architecture, the multi-tenant data foundation, and identity/access — everything every later phase depends on. No customer-facing operational feature ships in this phase; it is entirely enabling infrastructure.

## Scope

- Monorepo scaffold: `apps/web`, `apps/worker`, `packages/*` per [Project Structure](../08-engineering/project-structure.md).
- Supabase project setup (Local, Preview, Staging, Production) per [Environment Management](../10-devops/environment-management.md).
- Base database schema: `organizations`, `users`, `organization_memberships`, `roles`, `permissions`, `role_permissions`, with RLS established as the default pattern from the first table — see [ADR-007](../11-adr/ADR-007-multi-tenancy.md).
- Supabase Auth integration: signup, login, MFA for Owner/Admin — see [Identity PRD](../06-modules/identity-prd.md).
- Organization creation and Team management — see [Organization PRD](../06-modules/organization-prd.md).
- CI/CD pipeline: lint, type-check, test, migration safety check, Preview Deployments — see [CI/CD](../10-devops/ci-cd.md).
- Base observability: Sentry, Axiom, native platform monitoring — see [ADR-021](../11-adr/ADR-021-observability.md).
- Seed data: platform-defined Roles/Permissions, `trade_types` (Plumbing, HVAC, Electrical) — see [Seed Data](../04-database/seed-data.md).
- Audit logging infrastructure (the generic trigger, `audit_events` table) — see [ADR-012](../11-adr/ADR-012-audit-logging.md).

## Dependencies

None — this is the root of the dependency graph in [Implementation Roadmap](../13-roadmap/implementation-roadmap.md).

## Exit criteria

- A new Organization can be created, an Owner can invite an Admin/Dispatcher/Technician/Accountant, and Roles correctly gate access — verified end to end.
- Cross-tenant isolation tests pass for every table created in this phase.
- CI/CD pipeline deploys to Staging automatically on merge and supports manual Production promotion.
- Every table created in this phase has RLS, audit logging, and appropriate indexes per [Database Instructions](../12-claude/database-instructions.md).

## Explicitly out of scope for this phase

Any Customer, Property, Job, or financial entity — those begin in Technical Implementation Phase 2 (Strategic Phase 1: Core Operations). See [Phase 2: Core Operations](./phase-2-core-operations.md).

## Detail

See [Sprint 0](./sprint-0.md) and [Sprint 1](./sprint-1.md) for the week-by-week breakdown of this phase.

## Related documents

[Identity PRD](../06-modules/identity-prd.md) · [Organization PRD](../06-modules/organization-prd.md) · [Multi-Tenancy](../04-database/multi-tenancy.md) · [ADR-007](../11-adr/ADR-007-multi-tenancy.md)
