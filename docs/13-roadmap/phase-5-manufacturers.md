# Phase 5: Manufacturer Integrations

## Goal

Move from manual Manufacturer/Warranty record-keeping to direct integration with manufacturer partner systems for warranty registration and product compliance data. See [Vision](../00-overview/vision.md), pillar 4, and [Manufacturers PRD](../06-modules/manufacturers-prd.md).

## Scope

- Manufacturer partnership development (business/commercial work, outside this documentation's scope, but a hard prerequisite).
- Warranty registration API integration: an Asset install automatically registers with the manufacturer, replacing the launch-scope manual entry flow — see [Warranties PRD](../06-modules/warranties-prd.md), Future Extensions.
- Product catalog/spec sync, enriching Asset records at creation time beyond staff-entered manufacturer/model/serial.
- Manufacturer-facing partner portal/dashboard (a new, distinct persona surface — see [User Personas](../00-overview/user-personas.md), Future-phase personas).

## Dependencies

Requires [Phase 2: Core Operations](./phase-2-core-operations.md) complete, specifically mature [Assets](../03-domain/assets.md) and [Warranties](../03-domain/warranties.md) modules with real installation data — a manufacturer partner integration is only valuable once Atlas can reliably supply real, well-structured installation records to register.

## Exit criteria

- At least one manufacturer partnership live with automated warranty registration.
- Registration success rate and data-quality metrics meet the partnership's agreed standard.
- No degradation to the existing manual Warranty entry path — automated registration is additive, not a replacement that could leave a gap if a specific manufacturer isn't yet integrated.

## Explicitly out of scope for this phase

Manufacturer-initiated recall/service-bulletin push notifications into Atlas — a plausible future extension, not committed scope for this phase.

## Related documents

[Manufacturers PRD](../06-modules/manufacturers-prd.md) · [Warranties PRD](../06-modules/warranties-prd.md) · [Manufacturers](../03-domain/manufacturers.md) · [Assets](../03-domain/assets.md)
