# Jobs — PRD

## 1. Purpose

Jobs is the central operational module: creating, tracking, and executing units of work from intake through completion. See [Jobs](../03-domain/jobs.md).

## 2. Business problem

Without a structured Job record, businesses lose track of what was promised, what checklist steps matter for a given job type, and what actually happened — leading to missed steps, compliance gaps, and disputes about what was or wasn't done.

## 3. Goals

- Every Job has a clear, enforced lifecycle from creation to completion.
- Job Type-driven checklists ensure consistent, trade-appropriate work quality without hard-coding trade logic.
- Job history is permanently tied to the correct Property/Assets/Customer.

## 4. Non-goals

- Project/construction-style multi-phase Jobs with draws and change orders — see [Product Scope](../01-product/product-scope.md).

## 5. Personas

[Denise (Dispatcher)](../00-overview/user-personas.md) (creates/manages), [Curtis (Technician)](../00-overview/user-personas.md) (executes).

## 6. User stories

See [User Stories](../01-product/user-stories.md), Jobs, Scheduling, Dispatch section.

## 7. Functional requirements

Create Job against Customer/Property/optional Assets; select Job Type (loads default checklist); status-transition endpoints; ad hoc Task addition; Job cancellation with reason code.

## 8. Business rules

Full detail in [Jobs](../03-domain/jobs.md) — notably: a Job always has a `property_id`; required Tasks/compliance gate completion; completed Jobs are immutable on core facts.

## 9. State machines

See [Jobs](../03-domain/jobs.md#state-machine) for the full `draft → scheduled → dispatched → in_progress → (on_hold) → completed/cancelled` diagram.

## 10. Data requirements

`jobs`, `job_assets`, `job_assignments`, `job_status_history`, `job_types`, `service_categories` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH /api/v1/jobs`, `POST /api/v1/jobs/{id}/{transition}` (e.g., `/dispatch`, `/start`, `/hold`, `/resume`, `/complete`, `/cancel`), `GET /api/v1/jobs/{id}/tasks`. See [Resource Conventions](../05-api/resource-conventions.md) for why transitions are dedicated endpoints, not a generic status `PATCH`.

## 12. Permission requirements

Dispatcher/Admin/Owner: full read/write. Technician: read/write limited to assigned Jobs (`jobs:write_assigned`). Accountant: read-only.

## 13. UI requirements

Job list (filterable by status/priority/Job Type), Job detail page (Property/Asset context, checklist, Documents, linked Estimate/Invoice), mobile-first Job execution view for Technicians — see [Mobile PRD](./mobile-prd.md).

## 14. Notifications

Job scheduled/dispatched/rescheduled/completed trigger Customer and/or Technician notifications — see [Notifications PRD](./notifications-prd.md).

## 15. Audit requirements

Every status transition and field edit produces an [Audit Event](../03-domain/audit-events.md); `job_status_history` additionally provides a fast, denormalized transition log for UI display without querying the full audit table.

## 16. Error cases

Invalid state transition attempt (`409`); completing a Job with an incomplete required Task and no override (`422`); creating a Job without a `property_id` and no placeholder-Property configured for the Organization (`422`).

## 17. Edge cases

A Job needs to be split (customer requests two unrelated repairs during one visit) — handled by creating a second Job referencing the same visit's Dispatch context, not by allowing one Job to represent two unrelated scopes of work, since Estimates/Invoices are Job-scoped. A multi-day Job (e.g., a two-day panel upgrade) — modeled as one Job with multiple Schedule Events, not multiple Jobs.

## 18. Acceptance criteria

See [Acceptance Criteria](../01-product/acceptance-criteria.md), Job state machine integrity; plus: **Given** a Job Type with a required "photo of completed work" Task, **when** a Technician attempts to complete the Job without that Task done, **then** the completion request is rejected with a clear message naming the missing Task.

## 19. Testing requirements

State machine transition tests (every valid and invalid transition); integration tests for checklist-gated completion; RLS tests for Technician `write_assigned` scoping.

## 20. Future extensions

Recurring/maintenance-contract Jobs (auto-generated on a schedule); Job templates beyond checklist (full workflow templates); multi-visit Job sequencing for larger installs.
