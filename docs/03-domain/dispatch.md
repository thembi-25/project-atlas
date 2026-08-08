# Dispatch

## Purpose

Dispatch is the act of formally handing off a [Scheduled](./scheduling.md) [Job](./jobs.md) to its assigned [Technician(s)](./technicians.md) — notifying them, making the Job's full context (Property/Asset history, checklist, Customer notes) available on their device, and transitioning the Job to `dispatched`.

## Key attributes (via `dispatch_events`)

- `job_id`, `dispatched_at`, `dispatched_by_user_id` (the Dispatcher or an automated rule).
- `acknowledged_at` (when the Technician confirms receipt on their device).
- `en_route_at` (Technician marks themselves en route — triggers customer notification).
- `arrived_at`.

## Relationships

- **Belongs to** one [Job](./jobs.md), following a valid [Scheduling](./scheduling.md) event.
- **Triggers** [Notifications](../06-modules/notifications-prd.md) to both the Technician and the Customer.

## Business rules

1. A Job can only be dispatched from `scheduled` status; dispatching transitions it to `dispatched` (see [Jobs](./jobs.md), State Machine).
2. Dispatch is per-Job, not per-Technician-assignment — for a multi-Technician Job, all assigned Technicians receive the dispatch notification simultaneously; there is no launch-scope concept of dispatching to one Technician on a multi-person Job before another.
3. The Technician must explicitly acknowledge dispatch in the mobile app (`acknowledged_at`); an un-acknowledged dispatch older than a configurable threshold surfaces as an alert on the Dispatcher's board, since a Technician who hasn't seen their assignment is an operational risk, not just a UX nicety.
4. Marking "en route" and "arrived" are Technician-initiated, timestamped events that drive Customer-facing notifications ("Your technician is on the way") — see [Notifications PRD](../06-modules/notifications-prd.md).

## Data requirements

`dispatch_events` (`job_id`, `dispatched_at`, `dispatched_by_user_id`, `acknowledged_at`, `en_route_at`, `arrived_at`).

## API requirements

Dispatch action endpoint (transitions Job + creates `dispatch_events` row), Technician-facing acknowledge/en-route/arrived endpoints. See [Dispatch PRD](../06-modules/dispatch-prd.md).

## Permission requirements

Dispatcher/Admin/Owner: can dispatch. Technician: can acknowledge/update their own dispatch status only for Jobs assigned to them.

## Related documents

[Dispatch PRD](../06-modules/dispatch-prd.md) · [Scheduling](./scheduling.md) · [Jobs](./jobs.md) · [Mobile PRD](../06-modules/mobile-prd.md)
