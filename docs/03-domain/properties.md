# Properties

## Purpose

A Property is a physical location where work is performed. Properties are **first-class, persistent entities** that outlive any single Job and any single Customer relationship — this is the structural basis of the Property Intelligence pillar of the [Vision](../00-overview/vision.md) and must not be modeled as a mere attribute of a Job or Customer.

## Key attributes

- Address (street, city, state, postal code, geocoded lat/long for scheduling/routing).
- Property type: `residential_single_family`, `residential_multi_unit`, `commercial`.
- Access notes (gate codes, pets, parking instructions) — staff/technician-facing only, never customer-portal-visible by default.
- Current primary Customer/owner-of-record association (see Business Rules — this is a pointer, not a hard-coded foreign key relationship that implies exclusivity).

## Relationships

- **Belongs to** one [Organization](./organization.md).
- **Associated with** one or more [Customers](./customers.md) over time, via a `property_customer_associations` join with an effective date range (current + historical).
- **Has many** [Buildings](./buildings.md) (a single-family home typically has exactly one implicit Building; a commercial Property may have several).
- **Has many** [Assets](./assets.md) directly, or via a Building/Room for precise location.
- **Has many** [Jobs](./jobs.md) performed at this location, across any Customer association period.

## Business rules

1. A Property's identity is independent of any Customer — when a home is sold or a commercial property changes management companies, the Property record, its Buildings/Rooms, and its Asset/Job history persist unchanged; only the current `property_customer_associations` row changes. This is the single most important rule for the Property Intelligence pillar and must never be violated by a schema shortcut that ties Property directly and exclusively to one Customer.
2. A Job always references a Property (even a "shop work" or non-address Job uses an Organization-level placeholder Property — see [Jobs](./jobs.md)) so that Job history is always property-attributable.
3. Duplicate Property detection (same address entered twice) is a data-quality concern handled at Property creation (address normalization/geocoding match), not resolved later by merging, since merging would risk silently combining two different Organizations' — or two genuinely different physical locations' — Asset histories.
4. Deleting a Property is a soft delete and is blocked while the Property has any non-deleted Job, Asset, or Building/Room referencing it. See [Soft Deletion](../04-database/soft-deletion.md).

## Data requirements

`properties` table: `organization_id`, `address_*` fields, `property_type`, `access_notes`, `deleted_at`, timestamps. `property_customer_associations`: `property_id`, `customer_id`, `effective_from`, `effective_to` (nullable = current). See [Schema Overview](../04-database/schema-overview.md), [Entity Relationships](../04-database/entity-relationships.md).

## API requirements

Full CRUD, plus a dedicated "service history" read endpoint returning all Jobs/Assets for a Property regardless of which Customer association was active at the time. See [Properties PRD](../06-modules/properties-prd.md).

## Permission requirements

Dispatcher, Admin, Owner: read/write. Technician: read-only, scoped to Properties tied to their assigned Jobs. Accountant: read-only.

## Related documents

[Properties PRD](../06-modules/properties-prd.md) · [Buildings](./buildings.md) · [Assets](./assets.md) · [Market Positioning](../00-overview/market-positioning.md)
