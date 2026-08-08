# Market Positioning

## Category

Project Atlas competes in the **field service management (FSM) software** category, initially for the trades segment (plumbing, HVAC, electrical), with a long-term positioning as a **vertical Industry Cloud Platform** — a category that extends FSM with property data, supplier commerce, and manufacturer integration, similar in structural ambition to how vertical clouds have reshaped other trades-adjacent industries (construction, real estate, healthcare).

## Competitive landscape (informational — not a build target)

The FSM space includes established point solutions covering scheduling/dispatch/invoicing for trades businesses (e.g., ServiceTitan for larger operations, Housecall Pro and Jobber for small teams, FieldEdge and ServiceFusion in the mid-market). This document exists to clarify *positioning*, not to reverse-engineer or clone any competitor's implementation.

Common characteristics of the incumbent category:
- Strong on scheduling/dispatch/invoicing (Core Operations equivalent).
- Weak or absent on treating the **property and its assets** as a persistent, cross-job, cross-vendor data asset.
- Weak or absent on **supplier/manufacturer integration** inside the job workflow itself.
- Typically priced and packaged for a single trade's workflow conventions, retrofitted per trade rather than designed as trade-agnostic from the start.

## Atlas's positioning

> "The operations platform for field-service businesses, built around the property, not just the job."

Three positioning pillars:

1. **Trade-agnostic infrastructure.** One platform architecture, not a plumbing product awkwardly adapted for electricians. See [ADR-009](../11-adr/ADR-009-domain-modules.md).
2. **Property-centric, not job-centric.** Competitors' data models are optimized around scheduling a job and invoicing it. Atlas is optimized around the property and asset outliving the job — this is the basis for Property Intelligence (pillar 2 of the [Vision](./vision.md)).
3. **Platform, not point tool.** The roadmap explicitly plans for supplier, manufacturer, and financial-services integration built on the operational core, positioning Atlas as infrastructure the ecosystem connects to, not a tool a business merely subscribes to.

## Who we are positioned against, and who we are not

- We are positioned against the **status quo of spreadsheets, paper, and disconnected point tools** used by the majority of small trades businesses, more than against any single named competitor. The majority of the addressable market is not currently using modern FSM software at all.
- We are not positioned as an enterprise franchise management platform, a construction project management tool, or a general field-service framework for every service industry (e.g., landscaping, pest control, cleaning) at launch.
- We are not positioned as an AI product. Marketing and product positioning must not lead with "AI-powered" as the primary claim — see [Product Principles](./product-principles.md).

## Positioning implications for the roadmap

Because "property-centric" is a structural, not a marketing, claim, it must be true in the data model from the first schema (see [Properties](../03-domain/properties.md), [Assets](../03-domain/assets.md)) — it cannot be added later without a data migration that back-fills history we never captured. This is why Properties and Assets are core Strategic Phase 2 scope rather than a later differentiation feature. See [Implementation Roadmap](../13-roadmap/implementation-roadmap.md).
