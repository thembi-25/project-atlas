# Roles

## Purpose

A Role is a named, Organization-scoped bundle of [Permissions](./permissions.md) assigned to a [Membership](./users.md#membership). Roles are how Atlas implements Role-Based Access Control (RBAC). See [ADR-008: RBAC](../11-adr/ADR-008-rbac.md).

## Platform-defined Roles (launch scope)

| Role | Summary | Typical persona |
|---|---|---|
| **Owner** | Full access to everything in the Organization, including billing, and the only Role that can remove another Owner. Exactly one Owner Membership must always exist. | [Maria](../00-overview/user-personas.md) |
| **Admin** | Full operational and financial access; cannot modify billing/subscription ownership. | Office manager acting with full authority |
| **Dispatcher** | Full access to Customers, Properties, Jobs, Scheduling, Dispatch; read-only on financials; no access to Organization settings. | [Denise](../00-overview/user-personas.md) |
| **Technician** | Access limited to assigned Jobs and the Customers/Properties/Assets tied to those Jobs; can create Estimates/complete Jobs; no access to other Technicians' schedules or org-wide reporting. | [Curtis](../00-overview/user-personas.md) |
| **Accountant** | Full access to Estimates, Invoices, Payments, and financial reporting; read-only on Jobs/Scheduling; no access to Organization settings. | [Priya](../00-overview/user-personas.md) |
| **Read Only** | Read access across operational and financial data, no write access anywhere. | External accountant, auditor |

Customer Portal access is **not** a Membership Role — portal Contacts authenticate through a separate, scoped mechanism described in [Customer Portal PRD](../06-modules/customer-portal-prd.md), not through `organization_memberships`.

## Business rules

1. Roles are Organization-scoped: the same platform-defined Role names apply consistently across every Organization; there is no per-Organization custom Role definition at launch (see Future Extensions below).
2. A Membership can hold more than one Role (e.g., a small business owner who is also the primary Technician holds both Owner and Technician) — effective Permissions are the union of all held Roles' Permissions.
3. Role changes take effect immediately for new requests — Atlas does not rely on cached, stale JWT claims for authorization decisions (see [Tenant Isolation](../07-security/tenant-isolation.md) for why RLS checks live Membership state, not JWT claims).
4. The Owner Role cannot be self-removed if it is the Organization's last Owner Membership — enforced at the application layer and validated by a database constraint/trigger. See [Constraints](../04-database/constraints.md).

## Role-to-module access summary

| Module area | Owner | Admin | Dispatcher | Technician | Accountant | Read Only |
|---|---|---|---|---|---|---|
| Organization settings | RW | RW | — | — | — | R |
| Users/Roles | RW | RW | — | — | — | R |
| Customers/Properties | RW | RW | RW | R (assigned only) | R | R |
| Jobs/Scheduling/Dispatch | RW | RW | RW | RW (assigned only) | R | R |
| Estimates/Invoices | RW | RW | R | RW (assigned Jobs) | RW | R |
| Payments | RW | RW | R | R (capture on assigned Jobs) | RW | R |
| Inventory | RW | RW | R | RW (consumption only) | R | R |
| Analytics/Reporting | RW | RW | R (own team) | — | RW | R |

Exact endpoint-level enforcement is defined in [Authorization](../05-api/authorization.md) and each module's PRD "Permission Requirements" section.

## Future extensions

- Custom, per-Organization Roles with a configurable Permission set (see [Permissions](./permissions.md), Future Extensions) — deferred because launch's fixed Role set covers the target segment's org structures without added complexity.
- Team-scoped Dispatcher Roles (a Dispatcher restricted to one Team's Technicians) for larger, multi-crew Organizations.

## Related documents

[Permissions](./permissions.md) · [Users](./users.md) · [Authorization](../05-api/authorization.md) · [ADR-008: RBAC](../11-adr/ADR-008-rbac.md)
