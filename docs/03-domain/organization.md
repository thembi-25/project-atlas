# Organization

## Purpose

The Organization is the tenant boundary for Project Atlas. It represents one field-service business (e.g., "Riverside Plumbing LLC") and is the root of ownership for every other business entity. See [Terminology](../00-overview/terminology.md), [Multi-Tenancy](../04-database/multi-tenancy.md).

## Key attributes

- Legal/display name, business address, primary contact info.
- **Trade types offered** — one or more of the platform's `trade_types` (a plumbing-only Organization vs. a multi-trade Organization offering plumbing, HVAC, and electrical).
- Timezone and locale defaults (used for scheduling display).
- Subscription tier and billing status (see [Pricing Strategy](../01-product/pricing-strategy.md)) — owned conceptually by Organization but the billing record itself lives with the billing/payments provider, not modeled as a full domain entity in launch scope.
- Branding basics used on customer-facing documents (logo, business phone/email shown on Estimates/Invoices).

## Relationships

- **Has many** Users, via [Membership](./users.md) (a User can belong to more than one Organization).
- **Has many** [Teams](./users.md#teams) — optional groupings of Users for scheduling/reporting.
- **Has many** [Customers](./customers.md), [Properties](./properties.md), [Jobs](./jobs.md), [Suppliers](./suppliers.md), [Inventory Items](./inventory.md).
- **Configures** its own `job_types`, `asset_types`, `checklist_templates` (extending platform defaults) — see [Domain Overview](./domain-overview.md#the-trade-agnostic-configuration-pattern).

## Business rules

1. Every tenant-owned record traces back to exactly one Organization, directly or via an unambiguous parent chain. There is no cross-Organization sharing of business data (Customers, Properties, Jobs) — see [Tenant Isolation](../07-security/tenant-isolation.md).
2. An Organization must have at least one User with the **Owner** Role at all times; the last Owner Membership cannot be removed or downgraded without transferring ownership first. See [Roles](./roles.md).
3. Deleting/deactivating an Organization is a soft, reversible operation with a defined data-retention window (see [Data Protection](../07-security/data-protection.md)) — it is never an immediate hard delete given financial and audit retention obligations.
4. An Organization's selected `trade_types` govern which `job_types`/`asset_types` are available by default, but staff can still create custom types scoped to their Organization — configuration is per-Organization, not global to the platform (aside from platform-seeded defaults).

## Data requirements

Organization is the anchor for the `organization_id` column present on every tenant-owned table — see [Database Architecture](../04-database/database-architecture.md), [Multi-Tenancy](../04-database/multi-tenancy.md).

## Permission requirements

Only Owner and Admin Roles can modify Organization-level settings (billing, trade types offered, branding). See [Permissions](./permissions.md).

## Related documents

[Organization PRD](../06-modules/organization-prd.md) · [Users](./users.md) · [Roles](./roles.md) · [ADR-007: Multi-Tenancy](../11-adr/ADR-007-multi-tenancy.md)
