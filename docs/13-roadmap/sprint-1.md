# Sprint 1: Identity & Organizations

> Part of Technical Implementation Phase 1 ([Phase 1: Foundation](./phase-1-foundation.md)). See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md), Section C. Previous: [Sprint 0](./sprint-0.md). Next: [Sprint 2](./sprint-2.md).

## Goal

A person can sign up, create an Organization, invite teammates with Roles, and have tenant isolation and RBAC actually enforced — the foundation every later sprint depends on.

## Deliverables

1. `organizations`, `users`, `organization_memberships`, `roles`, `permissions`, `role_permissions` tables with RLS enabled/forced from their first migration — per [Identity](../03-domain/users.md), [Organization](../03-domain/organization.md), [Multi-Tenancy](../04-database/multi-tenancy.md).
2. Seed data: platform-defined Roles (Owner, Admin, Dispatcher, Technician, Accountant, Read Only), Permissions, `role_permissions` mapping, `trade_types` — per [Seed Data](../04-database/seed-data.md).
3. Supabase Auth integration: signup, login, session handling, MFA enrollment for Owner/Admin — per [Identity PRD](../06-modules/identity-prd.md), [ADR-006](../11-adr/ADR-006-authentication.md).
4. Organization creation flow, invitation flow (email invite → accept → active Membership) — per [Identity PRD](../06-modules/identity-prd.md).
5. Team creation and membership — per [Organization PRD](../06-modules/organization-prd.md).
6. Audit logging trigger infrastructure applied to these first tables — per [ADR-012](../11-adr/ADR-012-audit-logging.md).
7. Cross-tenant isolation tests and Role-permission matrix tests for every endpoint built this sprint — per [Database Testing](../09-testing/database-testing.md), [Security Testing](../09-testing/security-testing.md).

## Exit criteria

Two separate Organizations can be created by two different Owners; each can invite Users with different Roles; a Technician in Organization A cannot see anything from Organization B, and cannot access Owner-only settings within their own Organization — all verified by automated tests, not just manual click-through.

## Related documents

[ROADMAP-DECISION.md](./ROADMAP-DECISION.md) · [Phase 1: Foundation](./phase-1-foundation.md) · [Identity PRD](../06-modules/identity-prd.md) · [Organization PRD](../06-modules/organization-prd.md) · [Sprint 0](./sprint-0.md) · [Sprint 2](./sprint-2.md)
