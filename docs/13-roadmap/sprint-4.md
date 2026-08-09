# Sprint 4: Jobs, Scheduling & Dispatch

> Part of Technical Implementation Phase 2 ([Phase 2: Core Operations](./phase-2-core-operations.md) — implements Strategic Product Phase 1: Core Operations). See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md), Section C.1. Previous: [Sprint 3](./sprint-3.md). Next: Sprint 5 — Estimates, Invoicing & Payments.
>
> This document did not exist before this sprint began — [ROADMAP-DECISION.md](./ROADMAP-DECISION.md) Section C.1 notes Sprints 3–7's detailed sprint documents are "to be authored when each sprint begins." Authored now, at the start of Sprint 4, from that section plus [Jobs PRD](../06-modules/jobs-prd.md), [Scheduling PRD](../06-modules/scheduling-prd.md), and [Dispatch PRD](../06-modules/dispatch-prd.md), matching [Sprint 2](./sprint-2.md)/[Sprint 3](./sprint-3.md)'s structure.
>
> **Status: Complete — see [SPRINT-4-COMPLETION-REPORT.md](./SPRINT-4-COMPLETION-REPORT.md).**

## Goal

Jobs as the central operational entity of Core Operations: a Job requires a Customer and a Property (per [ROADMAP-DECISION.md](./ROADMAP-DECISION.md) Section D, "Sprint 2 & Sprint 3 → Sprint 4"), optionally references Assets, and drives the field-service workflow — Job Type-driven checklist, the documented `draft → scheduled → dispatched → in_progress → (on_hold) → completed/cancelled` state machine, Scheduling (time window + Technician assignment), and Dispatch (hand-off + acknowledgment timestamps). This is the largest relationship graph yet: Job ties together Sprint 2's Customer, Sprint 3's Property/Asset, and Sprint 1's User/Membership/Team infrastructure, while introducing genuinely new concerns this codebase has not yet needed — a server-authoritative sequential Job number, a formal enumerated state machine with transition-only mutation, and time-window conflict detection.

## Deliverables

1. `jobs` Postgres schema: `job_types`, `service_categories`, `checklist_templates`, `checklist_template_items`, `jobs`, `job_number_counters`, `job_assets`, `job_assignments`, `job_status_history`, `tasks`, `schedule_events`, `schedule_event_assignments`, `schedule_event_history`, `dispatch_events` — with RLS enabled/forced, following the established Sprint 1–3 pattern. Per [Jobs](../03-domain/jobs.md), [Tasks](../03-domain/tasks.md), [Scheduling](../03-domain/scheduling.md), [Dispatch](../03-domain/dispatch.md), [Schema Overview](../04-database/schema-overview.md).
2. Job CRUD + explicit transition-command endpoints (`/schedule`, `/dispatch`, `/acknowledge`, `/en-route`, `/arrived`, `/start`, `/hold`, `/resume`, `/complete`, `/cancel`) rather than an unrestricted `status` `PATCH`, per [Resource Conventions](../05-api/resource-conventions.md) and [Jobs PRD](../06-modules/jobs-prd.md) §11.
3. Scheduling board read endpoint (date-range/Technician/Team-filterable) and a conflict-check endpoint that warns without blocking, per [Scheduling PRD](../06-modules/scheduling-prd.md).
4. Job detail UI (Customer/Property/Asset context, status, priority, Tasks, schedule, assignment, dispatch, activity history) and a minimal schedule board — per both PRDs' UI Requirements. No separate mobile PWA is built this sprint (see "Deviations" in the completion report); the Technician-facing execution view lives in the same responsive `apps/web` application, since no mobile app package exists yet and one is not justified by Sprint 4 alone.
5. The trade-agnostic `job_types`/`service_categories`/`checklist_templates` configuration entities (platform defaults + Organization extensions), per [ADR-009](../11-adr/ADR-009-domain-modules.md) — no per-trade schema branching, and Tasks are copied onto a Job from its template at creation time (never a live reference), per [Tasks](../03-domain/tasks.md) business rule 1.
6. Full test coverage: unit (state-machine transitions, conflict-window overlap logic), integration (RLS, cross-tenant relationship rejection across Customer/Property/Asset/Technician, the ten mandatory tenant-isolation scenarios), API (CRUD + transition endpoints + permission matrix).

## Exit criteria

A Job can be created against a Customer/Property (optionally Assets), scheduled to a time window with one or more Technicians, dispatched, acknowledged, and carried through to completion or cancellation — with every transition validated against the documented state machine, a permanent `job_status_history`/audit trail, and full tenant isolation — verified end to end, including that Organization A can never read, modify, schedule, assign to, or dispatch Organization B's Jobs, nor attach Organization B's Customer/Property/Asset/Technician to one of its own Jobs.

## Related documents

[ROADMAP-DECISION.md](./ROADMAP-DECISION.md) · [Phase 2: Core Operations](./phase-2-core-operations.md) · [Jobs PRD](../06-modules/jobs-prd.md) · [Scheduling PRD](../06-modules/scheduling-prd.md) · [Dispatch PRD](../06-modules/dispatch-prd.md) · [Sprint 3](./sprint-3.md)
