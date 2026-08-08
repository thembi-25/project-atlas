# Assets

## Purpose

An Asset is a piece of installed equipment tracked over its full lifecycle — a water heater, an HVAC condenser, an electrical panel, a well pump. Assets are the concrete unit of Property Intelligence: they carry manufacturer/model/serial data, install date, and a complete history of every Job performed against them. See [Vision](../00-overview/vision.md), pillar 2.

## Key attributes

- `asset_type_id` — references the `asset_types` configuration entity (e.g., "Tankless Water Heater", scoped to the Plumbing trade type). See [Domain Overview](./domain-overview.md#the-trade-agnostic-configuration-pattern).
- Manufacturer (reference to [Manufacturers](./manufacturers.md)), model number, serial number.
- Install date, install Job reference (which Job originally installed it, if known).
- Location: `property_id` (required), `building_id` and `room_id` (optional, for precision — see [Buildings](./buildings.md), [Rooms](./rooms.md)).
- Status: `active`, `removed`, `decommissioned`.
- Expected lifespan / next-service-due hints (used for Phase 3 Property Intelligence features — see [Roadmap Phase 3](../13-roadmap/phase-3-property-intelligence.md)).

## Relationships

- **Belongs to** one [Property](./properties.md), optionally located within a [Building](./buildings.md)/[Room](./rooms.md).
- **Referenced by** many [Jobs](./jobs.md) over its lifetime (installation, service, repair, replacement).
- **Has** zero or more [Warranties](./warranties.md).
- **References** a [Manufacturer](./manufacturers.md) (optional — not every Asset has a known manufacturer at data-entry time).

## Business rules

1. An Asset's history (every linked Job) is permanent and survives changes in Property ownership/Customer association — see [Properties](./properties.md), Business Rules.
2. An Asset marked `removed` or `decommissioned` is not deleted; it remains visible in Property history with its end-of-life date, since "this water heater was replaced in 2023" is itself valuable Property Intelligence.
3. A Job that installs a new unit where an old one existed should mark the old Asset `removed`/`decommissioned` and create a new Asset record, rather than mutating the old Asset's manufacturer/model/serial fields in place — an Asset represents one physical unit, not a slot.
4. Assets can exist without a completed Job (e.g., bulk-imported from a Property survey) — a Job reference for install is optional, not required, to support onboarding existing customers with pre-existing equipment.

## Data requirements

`asset_types` (Organization-scoped, extensible from platform defaults; `trade_type_id`, `name`), `assets` (`property_id`, `building_id` nullable, `room_id` nullable, `asset_type_id`, `manufacturer_id` nullable, `model_number`, `serial_number`, `install_date`, `status`, `deleted_at`, timestamps). See [Schema Overview](../04-database/schema-overview.md).

## API requirements

Full CRUD, plus a "service history" endpoint returning all Jobs referencing the Asset ordered by date. See [Assets PRD](../06-modules/assets-prd.md).

## Permission requirements

Same visibility rules as the parent [Property](./properties.md).

## Related documents

[Assets PRD](../06-modules/assets-prd.md) · [Properties](./properties.md) · [Warranties](./warranties.md) · [Manufacturers](./manufacturers.md) · [ADR-009](../11-adr/ADR-009-domain-modules.md)
