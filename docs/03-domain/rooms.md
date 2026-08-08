# Rooms

## Purpose

A Room is a discrete space within a [Building](./buildings.md) (e.g., "Kitchen", "Mechanical Room", "Attic") used to precisely locate [Assets](./assets.md) so a Technician can find equipment without guesswork on a return visit.

## Key attributes

- Name/label (free text, e.g., "Basement Utility Room").
- Room type (optional, for filtering): `kitchen`, `bathroom`, `utility`, `attic`, `basement`, `garage`, `other`.
- Floor/level.

## Relationships

- **Belongs to** one [Building](./buildings.md).
- **Has many** [Assets](./assets.md) located in this Room.

## Business rules

1. Rooms are optional — an Asset can be located at the Property or Building level without a specific Room when precision isn't needed or known (e.g., "somewhere in the crawlspace"). Room-level location is a precision enhancement, not a mandatory data-entry burden on staff.
2. Deleting a Room is blocked while it has any non-deleted Asset directly located in it; the Asset must be relocated (to another Room, the Building, or marked removed) first.

## Data requirements

`rooms` table: `building_id`, `name`, `room_type`, `floor_level`, `deleted_at`, timestamps.

## Permission requirements

Inherits from [Properties](./properties.md) — no independent Room-level permission.

## Related documents

[Properties PRD](../06-modules/properties-prd.md) · [Buildings](./buildings.md) · [Assets](./assets.md)
