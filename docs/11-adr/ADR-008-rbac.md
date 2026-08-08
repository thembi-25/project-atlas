# ADR-008: Role-Based Access Control (RBAC)

## Status

Accepted

## Date

2026-08-08

## Context

Different staff at a field-service business need meaningfully different access — a Technician should never see organization-wide revenue; a Dispatcher shouldn't finalize Invoices (see [User Personas](../00-overview/user-personas.md)). Atlas needs an authorization model expressive enough for this without becoming a maintenance burden for a small target-customer organization to configure.

## Problem

Should Atlas implement fine-grained, per-user permission grants (ACL-style), fully custom per-Organization roles, or a fixed set of platform-defined roles?

## Decision

A **fixed set of platform-defined Roles** (Owner, Admin, Dispatcher, Technician, Accountant, Read Only), each a bundle of platform-defined Permissions, assigned via Organization Membership. No per-user permission overrides; no per-Organization custom Roles at launch. See [Roles](../03-domain/roles.md), [Permissions](../03-domain/permissions.md).

## Alternatives Considered

1. **Per-user, fully custom ACL grants** — rejected. Maximally flexible but places a configuration burden on small business owners (Atlas's target segment — see [Target Customers](../00-overview/target-customers.md)) who don't want to design a permission matrix; it also makes reasoning about "what can this person do" far harder to audit and test comprehensively.
2. **Fully custom, per-Organization Roles from launch** — rejected for launch, deferred as a documented future extension (see [Roles](../03-domain/roles.md), Future Extensions). The fixed Role set observed in the target segment's actual org structures (owner, dispatcher, technician, bookkeeper) covers the real-world variation without the added complexity of a Role-builder UI and the testing surface area it would require.
3. **A single flat "staff" permission level with no differentiation** — rejected outright. Fails the basic security/trust requirement that a Technician shouldn't see organization-wide financials, and fails licensing/audit expectations that different roles carry different accountability.

## Consequences

- The Permission model (`resource:action` pairs — see [Permissions](../03-domain/permissions.md)) is simple enough to fully test (a fixed matrix per Role, not an open-ended combinatorial space).
- Onboarding a new Organization requires no permission-configuration step beyond assigning the built-in Roles to invited Users.
- A genuine future need for finer-grained or custom Roles (e.g., a larger multi-branch Organization) is a known, deferred gap, not an oversight — tracked in [Roles](../03-domain/roles.md), Future Extensions.

## Risks

- The fixed Role set may not fit every future customer's org structure as Atlas moves upmarket (see [Target Customers](../00-overview/target-customers.md), Secondary segment) — accepted as a deliberate launch-scope trade-off, with custom Roles as the documented path forward if and when that need materializes.

## Migration / Rollback

Extending to custom, per-Organization Roles later is additive — the existing platform-defined Roles remain as sensible defaults/templates, and `role_permissions` becomes partially tenant-editable rather than entirely platform-fixed. No destructive change to existing Memberships is required to add this capability later.

## Related Decisions

[ADR-007: Multi-Tenancy](./ADR-007-multi-tenancy.md) · [Roles](../03-domain/roles.md) · [Permissions](../03-domain/permissions.md) · [Authorization](../05-api/authorization.md)
