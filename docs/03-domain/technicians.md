# Technicians

## Purpose

"Technician" is a functional role a [User](./users.md) plays within an Organization — it is **not** a separate identity table. A Technician is a User whose Membership includes the Technician Role (see [Roles](./roles.md)), optionally extended with field-specific attributes via a `technician_profiles` table. This mirrors the platform's general pattern of extending the generic User/Membership model rather than creating parallel identity systems per persona.

## Key attributes (via `technician_profiles`, optional extension of a Membership)

- Skills/trade certifications (references to `trade_types`, e.g., licensed for HVAC and Electrical).
- Home base / default starting location (for scheduling and routing).
- Working hours/availability pattern (used by [Scheduling](./scheduling.md)).
- Vehicle/truck identifier (used by [Inventory](./inventory.md) to track truck-stock separately from warehouse stock).

## Relationships

- **Is a** [User](./users.md) with a Technician-inclusive Membership Role.
- **Assigned to** [Jobs](./jobs.md) via `job_assignments`.
- **Consumes** [Inventory Items](./inventory.md) from their assigned truck stock location.
- **Completes** [Tasks](./tasks.md) and uploads [Documents](./documents.md).

## Business rules

1. A User can simultaneously hold the Technician Role and another Role (e.g., an owner-operator who is also Owner + Technician) — see [Roles](./roles.md), Business Rules.
2. A Job assignment references a User directly, not a separate "Technician ID," so historical assignment records remain valid even if that User's Role set later changes.
3. Technician skill/certification data (`technician_profiles`) informs Scheduling suggestions (e.g., don't suggest a plumbing-only Technician for an electrical Job) but is advisory, not a hard constraint — a Dispatcher can override.

## Data requirements

`technician_profiles` (`user_id`, `organization_id`, skills array, home base location, vehicle identifier) — one row per User per Organization where that User holds the Technician Role, created on first assignment or explicit setup rather than for every Membership by default.

## Permission requirements

A Technician can only read/write their own `technician_profiles` skills/availability preferences and Jobs assigned to them; Dispatchers/Admins can manage any Technician's profile within the Organization.

## Related documents

[Mobile PRD](../06-modules/mobile-prd.md) · [Scheduling PRD](../06-modules/scheduling-prd.md) · [Dispatch PRD](../06-modules/dispatch-prd.md) · [Users](./users.md) · [Roles](./roles.md)
