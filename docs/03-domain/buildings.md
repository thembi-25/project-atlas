# Buildings

## Purpose

A Building is a physical structure on a [Property](./properties.md). Most residential Properties have exactly one Building (created implicitly); commercial and multi-unit Properties may have several (e.g., a commercial plaza with Building A and Building B).

## Key attributes

- Name/label (e.g., "Main House", "Building A", "Unit 3B").
- Building type (optional): `main`, `detached_garage`, `outbuilding`, `unit`.
- Floor count, year built (optional, useful context for HVAC/electrical Assets).

## Relationships

- **Belongs to** one [Property](./properties.md).
- **Has many** [Rooms](./rooms.md).
- **Has many** [Assets](./assets.md) (an Asset can be located at the Building level without a specific Room, e.g., a rooftop condenser).

## Business rules

1. Every Property has at least one Building; a simple residential Property is provisioned with a single default Building ("Main House") automatically at Property creation, so Assets and Rooms always have a consistent parent regardless of Property complexity — staff never need to think about Buildings for a simple single-family home.
2. Deleting a Building is blocked while it has any non-deleted Room or Asset. See [Soft Deletion](../04-database/soft-deletion.md).

## Data requirements

`buildings` table: `property_id`, `name`, `building_type`, `floor_count`, `year_built`, `deleted_at`, timestamps.

## Permission requirements

Inherits from [Properties](./properties.md) — no independent Building-level permission.

## Related documents

[Properties PRD](../06-modules/properties-prd.md) · [Rooms](./rooms.md) · [Assets](./assets.md)
