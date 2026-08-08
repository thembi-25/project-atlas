# Permissions

## Purpose

A Permission is the atomic unit of access control: a (resource, action) pair, e.g., `jobs:write`, `invoices:read`, `organization:manage_billing`. [Roles](./roles.md) are named bundles of Permissions; Permissions themselves are platform-defined, not Organization-defined, at launch.

## Permission model

Permissions follow a `resource:action` convention:

| Resource | Actions |
|---|---|
| `organization` | `read`, `manage_settings`, `manage_billing`, `manage_users` |
| `customers`, `properties`, `assets` | `read`, `write`, `delete` |
| `jobs` | `read`, `read_assigned`, `write`, `write_assigned`, `delete`, `assign` |
| `scheduling` | `read`, `write` |
| `estimates`, `invoices` | `read`, `write`, `finalize`, `void` |
| `payments` | `read`, `capture`, `refund` |
| `inventory` | `read`, `write`, `consume` |
| `reports` | `read_own_team`, `read_organization` |
| `audit` | `read` |

Read-scoped variants (`read_assigned`, `read_own_team`) exist specifically to express the Technician and Dispatcher Roles' restricted visibility without needing row-level permission exceptions layered on top of RBAC — see [Roles](./roles.md).

## Enforcement points

Permissions are checked at two layers, both required, never one substituting for the other:

1. **API layer**: every route handler resolves the caller's effective Permissions from their Membership's Role(s) and rejects (403) any action the Permission set doesn't cover, before touching the database. See [Authorization](../05-api/authorization.md).
2. **Database layer (Row Level Security)**: independent of the API layer's check, RLS policies restrict which rows a given `auth.uid()` can select/insert/update/delete based on their Membership and Role, so a bug in API-layer permission logic cannot itself leak or corrupt tenant data. See [Tenant Isolation](../07-security/tenant-isolation.md).

This dual enforcement is deliberate defense-in-depth, not redundancy to be "optimized away" — see [Product Principles](../00-overview/product-principles.md), principle 3.

## Business rules

1. Permissions are never granted directly to a User; they are always mediated through a Role on a Membership. There is no per-User permission override at launch.
2. `read_assigned` for `jobs` means: a Technician can read a Job if and only if they are listed in that Job's assignments (see [Jobs](./jobs.md)) — this is enforced as an RLS policy joining `jobs` → `job_assignments` → the caller's `user_id`, not as an application-only filter.
3. Adding a new Permission requires updating the Role-to-Permission mapping deliberately; Permissions are never "on by default" for a Role that didn't previously have them, to avoid silent privilege escalation on deploy.

## Data requirements

`permissions` (platform-seeded reference table), `role_permissions` (join table mapping the platform's fixed Roles to Permissions — since Roles are platform-defined at launch, this table is seed data, not user-editable). See [Seed Data](../04-database/seed-data.md).

## Future extensions

Organization-defined custom Roles (see [Roles](./roles.md), Future Extensions) would make `role_permissions` partially tenant-editable; this is explicitly deferred past launch.

## Related documents

[Roles](./roles.md) · [Authorization](../05-api/authorization.md) · [Tenant Isolation](../07-security/tenant-isolation.md) · [ADR-008: RBAC](../11-adr/ADR-008-rbac.md)
