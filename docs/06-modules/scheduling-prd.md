# Scheduling — PRD

## 1. Purpose

Scheduling determines when a Job happens and which Technician(s) perform it, presented as a board/calendar view for Dispatchers. See [Scheduling](../03-domain/scheduling.md).

## 2. Business problem

A whiteboard or generic calendar has no awareness of Job duration by type, Technician skill/certification, or existing commitments — leading to double-bookings and inefficient routing discovered only when a Technician is already running late.

## 3. Goals

- One board showing every Technician's day/week at a glance, filterable by Team.
- Conflict detection that warns without blocking (Dispatcher judgment always wins).
- Fast rescheduling with automatic Customer re-notification.

## 4. Non-goals

- Fully automated, algorithmic route optimization/auto-dispatch — a human Dispatcher makes the final call at launch; see [AI Platform PRD](./ai-platform-prd.md) for why this isn't an AI-automated decision.

## 5. Personas

[Denise (Dispatcher)](../00-overview/user-personas.md) primarily.

## 6. User stories

See [User Stories](../01-product/user-stories.md), Jobs, Scheduling, Dispatch section.

## 7. Functional requirements

Week/day board view by Technician/Team; drag-to-schedule/reschedule; conflict warning on overlapping assignments; Job Type default duration pre-fill.

## 8. Business rules

Full detail in [Scheduling](../03-domain/scheduling.md) — notably: double-booking is warned, not blocked; rescheduling a dispatched/in-progress Job requires a reason and triggers Customer re-notification.

## 9. State machines

None independent of the parent [Job](../03-domain/jobs.md) state machine — Scheduling transitions a Job from `draft`/`scheduled` to `scheduled`.

## 10. Data requirements

`schedule_events`, `schedule_event_assignments`, `schedule_event_history` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET /api/v1/schedule?start=...&end=...&team_id=...`, `POST /api/v1/jobs/{id}/schedule`, `PATCH /api/v1/jobs/{id}/schedule` (reschedule, requires `reason`), `GET /api/v1/schedule/conflicts?user_id=...&start=...&end=...`.

## 12. Permission requirements

Dispatcher/Admin/Owner: full read/write. Technician: read-only, scoped to their own schedule.

## 13. UI requirements

Drag-and-drop week board, Technician availability overlay, conflict warning banner, quick-reschedule modal requiring a reason.

## 14. Notifications

Schedule confirmation to Customer, reschedule notice to Customer and Technician — see [Notifications PRD](./notifications-prd.md).

## 15. Audit requirements

Every schedule creation/change produces an [Audit Event](../03-domain/audit-events.md) and a `schedule_event_history` row.

## 16. Error cases

Scheduling a Job that's already `completed`/`cancelled` (`409`); rescheduling without a reason on a `dispatched`+ Job (`422`).

## 17. Edge cases

Two Technicians on one multi-person Job with different availability windows — the Job's `schedule_event` window is the union the Dispatcher explicitly sets, not auto-derived from individual availability. A Technician's availability pattern changes mid-week — existing scheduled Jobs are unaffected; only future scheduling suggestions reflect the change.

## 18. Acceptance criteria

**Given** a Technician already scheduled 9am–11am, **when** a Dispatcher schedules them for a second Job 10am–12pm, **then** the UI shows a conflict warning but allows the Dispatcher to confirm and proceed.

## 19. Testing requirements

Conflict-detection unit tests (including edge-adjacent windows); integration tests for reschedule-triggers-notification; performance test for board rendering at 50 Technicians/week (see [Non-Functional Requirements](../01-product/non-functional-requirements.md)).

## 20. Future extensions

Route/travel-time-aware suggested scheduling; auto-fill of open slots based on Technician skill match; Customer-selectable arrival windows via the Portal.
