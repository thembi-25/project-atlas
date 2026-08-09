# Sprint 3: Properties & Assets

> Part of Technical Implementation Phase 2 ([Phase 2: Core Operations](./phase-2-core-operations.md) — implements Strategic Product Phase 1: Core Operations). See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md), Section C.1. Previous: [Sprint 2](./sprint-2.md). Next: Sprint 4 — Jobs, Scheduling & Dispatch.
>
> This document did not exist before this sprint began — [ROADMAP-DECISION.md](./ROADMAP-DECISION.md) Section C.1 notes Sprints 3–7's detailed sprint documents are "to be authored when each sprint begins." Authored now, at the start of Sprint 3, from that section plus [Properties PRD](../06-modules/properties-prd.md) and [Assets PRD](../06-modules/assets-prd.md), matching [Sprint 1](./sprint-1.md)/[Sprint 2](./sprint-2.md)'s structure.
>
> **Status: Complete — see [SPRINT-3-COMPLETION-REPORT.md](./SPRINT-3-COMPLETION-REPORT.md).**

## Goal

Properties and Assets as durable, first-class records — independent of any single Customer relationship or Job — establishing the Property Intelligence pillar's structural foundation. Extends the full-stack pattern (schema+RLS → domain logic → API → UI → tests) Sprint 2 established, onto a materially more complex relationship graph (Property → Building → Room → Asset, plus a time-ranged Property ↔ Customer association).

## Deliverables

1. `properties`, `property_customer_associations`, `buildings`, `rooms`, `asset_types`, `assets` tables with RLS enabled/forced, following the established Sprint 1/2 pattern — per [Properties](../03-domain/properties.md), [Buildings](../03-domain/buildings.md), [Rooms](../03-domain/rooms.md), [Assets](../03-domain/assets.md).
2. Property/Asset CRUD API endpoints, a Property service-history endpoint (Jobs + Assets across all Customer associations — Jobs deferred, see Known Limitations), and a Customer-association management endpoint — per [Properties PRD](../06-modules/properties-prd.md), [Assets PRD](../06-modules/assets-prd.md) API Requirements.
3. Property detail UI (address, access notes, Buildings/Rooms, Asset list) and Asset creation/detail UI — per both PRDs' UI Requirements.
4. The trade-agnostic `asset_types` configuration entity (platform defaults + Organization extensions), per [ADR-009](../11-adr/ADR-009-domain-modules.md) — no per-trade schema branching.
5. Full test coverage: unit (validation, lifecycle), integration (RLS, cross-tenant relationship rejection, Property/Customer association history), API (CRUD + permission matrix).

## Exit criteria

A Property can be created independent of any Customer, associated with a Customer, have Buildings/Rooms/Assets recorded against it, and have that Customer association end and a new one begin — with the Property's identity, Buildings/Rooms, and Asset history fully intact throughout — verified end to end, including tenant isolation and the specific business rule that Property identity survives a Customer relationship change.

## Related documents

[ROADMAP-DECISION.md](./ROADMAP-DECISION.md) · [Phase 2: Core Operations](./phase-2-core-operations.md) · [Properties PRD](../06-modules/properties-prd.md) · [Assets PRD](../06-modules/assets-prd.md) · [Sprint 2](./sprint-2.md)
