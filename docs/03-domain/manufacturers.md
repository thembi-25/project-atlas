# Manufacturers

## Purpose

A Manufacturer is the maker of equipment installed as [Assets](./assets.md) (e.g., Carrier, Rheem, Square D). Manufacturer data underpins warranty tracking and, in Phase 5, deeper manufacturer integrations (warranty registration APIs, product compliance data).

## Key attributes

- Name, product categories (loosely mapped to `asset_types`), support contact info, warranty terms reference (base warranty length by product line, used as a default when a specific [Warranty](./warranties.md) isn't individually registered).

## Relationships

- **Referenced by** [Assets](./assets.md) (an Asset's manufacturer/model).
- **Referenced by** [Warranties](./warranties.md).
- **Referenced by** [Inventory Items](./inventory.md) (a part's manufacturer, distinct from an installed Asset's manufacturer).

## Business rules

1. Manufacturers are **platform-shared reference data** (not Organization-owned) — "Carrier" is the same record referenced by every Organization's Assets, since manufacturer identity is a real-world fact, not tenant-specific data. This is the one entity in the domain model that is intentionally cross-tenant, and it carries no tenant-owned or sensitive data (no RLS tenant-scoping applies to this table; it is platform-managed read-only reference data for all Organizations).
2. Organizations can add a Manufacturer not yet in the platform's shared list (e.g., a regional/niche brand); newly Organization-added Manufacturers start Organization-scoped and may be promoted to shared/platform status by platform admins after a data-quality review, to avoid duplicate/inconsistent entries proliferating across tenants.
3. Manufacturer records are never deleted (only deactivated) since historical Assets must always be able to resolve their manufacturer reference.

## Data requirements

`manufacturers` (platform-shared: `name`, product categories, support info, default warranty terms, `source_organization_id` nullable for Organization-added entries pending promotion, `is_platform_verified`, timestamps).

## Permission requirements

Read: all Organizations. Write (adding new Manufacturers): any staff Role with Property/Asset write access; promotion to platform-verified status is a platform-admin action outside normal Organization RBAC.

## Related documents

[Manufacturers PRD](../06-modules/manufacturers-prd.md) · [Assets](./assets.md) · [Warranties](./warranties.md) · [Roadmap Phase 5](../13-roadmap/phase-5-manufacturers.md)
