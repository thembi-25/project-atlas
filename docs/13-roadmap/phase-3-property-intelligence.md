# Phase 3: Property Intelligence

## Goal

Turn the Property/Asset history accumulated during Phase 2 into active intelligence — predictive maintenance signals, richer lifecycle reporting, and a more valuable Property record that makes quotes more accurate and upsell conversations more credible. See [Vision](../00-overview/vision.md), pillar 2.

## Scope

- Asset lifecycle analytics: expected-remaining-lifespan estimates informed by install date, Asset Type, and observed failure patterns across the Organization's own history (and, cautiously, anonymized cross-Organization patterns if [Phase 7](./phase-7-industry-network.md) has matured enough to inform this — otherwise, Organization-scoped only).
- Proactive maintenance-outreach suggestions surfaced to staff (e.g., "this water heater is approaching typical end-of-life; consider reaching out") — never automated outreach without staff review, consistent with [AI Platform PRD](../06-modules/ai-platform-prd.md)'s draft-only principle if any AI assistance is involved.
- Richer Property timeline UI: visual service history, Asset lifecycle view, warranty status at a glance.
- Expanded [Warranties](../03-domain/warranties.md) tracking depth (still manual entry at this phase — automated registration is [Phase 5](./phase-5-manufacturers.md)).

## Dependencies

Requires [Phase 2: Core Operations](./phase-2-core-operations.md) complete and in production for long enough to have accumulated meaningful Job/Asset history — this phase has no value against an empty or thin dataset. See [Product Strategy](../01-product/product-strategy.md).

## Exit criteria

- Property/Asset coverage metrics (see [Success Metrics](../01-product/success-metrics.md)) show a high percentage of Jobs linked to tracked Properties/Assets, confirming the data foundation is actually rich enough for this phase to have shipped meaningful value.
- Staff-facing lifecycle/maintenance-suggestion features are live and used, measured by an appropriate engagement metric to be defined closer to this phase's start.

## Explicitly out of scope for this phase

IoT/telemetry integration (see [Assets PRD](../06-modules/assets-prd.md), Future Extensions) — this phase works from data already captured through normal Job execution, not new sensor data sources.

## Related documents

[Vision](../00-overview/vision.md) · [Assets](../03-domain/assets.md) · [Properties](../03-domain/properties.md) · [Implementation Roadmap](./implementation-roadmap.md)
