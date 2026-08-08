# Dispatch — PRD

## 1. Purpose

Dispatch is the hand-off of a scheduled Job to its assigned Technician(s): notification, context delivery, and status tracking through en-route/arrival. See [Dispatch](../03-domain/dispatch.md).

## 2. Business problem

A phone call or group text for dispatch is slow, provides no structured job context, and leaves no record of whether the Technician actually saw the assignment before showing up (or not showing up).

## 3. Goals

- One-tap dispatch that delivers full Job/Property/Asset context to the Technician's device.
- Visibility into whether a Technician has acknowledged their dispatch.
- Customer-facing "on my way" transparency.

## 4. Non-goals

- Live GPS tracking/map view of Technician location — not launch scope (privacy and infrastructure complexity not yet justified; may be revisited alongside route optimization in a future phase).

## 5. Personas

[Denise (Dispatcher)](../00-overview/user-personas.md), [Curtis (Technician)](../00-overview/user-personas.md).

## 6. User stories

See [User Stories](../01-product/user-stories.md), Jobs, Scheduling, Dispatch section.

## 7. Functional requirements

Dispatch action from the schedule board or Job detail; Technician acknowledge/en-route/arrived actions from mobile; Dispatcher-facing un-acknowledged-dispatch alert.

## 8. Business rules

Full detail in [Dispatch](../03-domain/dispatch.md) — notably: dispatch is per-Job, all assigned Technicians notified simultaneously; un-acknowledged dispatch past a threshold surfaces as a Dispatcher alert.

## 9. State machines

Dispatch lifecycle timestamps (`dispatched_at → acknowledged_at → en_route_at → arrived_at`) — a forward-only sequence of optional timestamps, not a formal enumerated state machine, since a Technician may skip directly from acknowledged to arrived without explicitly marking en route.

## 10. Data requirements

`dispatch_events` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`POST /api/v1/jobs/{id}/dispatch`, `POST /api/v1/jobs/{id}/acknowledge`, `POST /api/v1/jobs/{id}/en-route`, `POST /api/v1/jobs/{id}/arrived`.

## 12. Permission requirements

Dispatcher/Admin/Owner: can dispatch. Technician: can acknowledge/update dispatch status only for their own assigned Jobs.

## 13. UI requirements

"Dispatch" button on scheduled Jobs; Dispatcher board indicator for acknowledged vs. pending dispatch; mobile push notification with one-tap acknowledge; "I'm on my way" button in the mobile Job detail view.

## 14. Notifications

Dispatch push/SMS to Technician; en-route SMS to Customer ("Your technician is on the way, ETA ~20 min"); un-acknowledged dispatch alert to Dispatcher. See [Notifications PRD](./notifications-prd.md).

## 15. Audit requirements

Every dispatch action and status timestamp produces an [Audit Event](../03-domain/audit-events.md), relevant for SLA/response-time disputes.

## 16. Error cases

Dispatching a Job not in `scheduled` status (`409`); a Technician attempting to acknowledge a Job they're not assigned to (`403`).

## 17. Edge cases

A Technician's device is offline when dispatched — the push notification queues for delivery on reconnect, and the Job/context data is available from local cache once the app opens; see [Mobile PRD](./mobile-prd.md) for offline behavior. A dispatch is sent, then the Job is rescheduled before acknowledgment — the original dispatch is implicitly superseded and a fresh dispatch is required after the new schedule is confirmed.

## 18. Acceptance criteria

**Given** a Job dispatched 20 minutes ago with no acknowledgment, **when** the Dispatcher views the schedule board, **then** an unacknowledged-dispatch indicator is visible on that Job.

## 19. Testing requirements

Integration tests for the full dispatch → acknowledge → en-route → arrived sequence; notification-delivery tests (mocked Twilio/push); permission tests for Technician self-scoping.

## 20. Future extensions

Live location sharing during en-route (opt-in, privacy-reviewed); automated ETA calculation from routing data; multi-technician independent acknowledgment tracking.
