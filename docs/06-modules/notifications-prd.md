# Notifications — PRD

## 1. Purpose

Deliver timely email/SMS/push notifications for scheduling, dispatch, financial, and account events to staff, Technicians, and Customers. See [Notifications](../02-architecture/event-driven-architecture.md#event-catalog-launch-scope) for the event catalog this module consumes.

## 2. Business problem

Customers and staff currently rely on phone calls for status updates ("is the technician close?", "did you get my payment?"), consuming office staff time that automated, well-timed notifications eliminate.

## 3. Goals

- Every meaningful state change relevant to a recipient triggers a timely, correctly-channeled notification.
- Recipients control their own channel/event preferences.
- Notification delivery is reliable and observable — a failed SMS is visible to operations, not silently dropped.

## 4. Non-goals

- Marketing/promotional messaging — Notifications are transactional/operational only, not a marketing channel (a future, clearly separated marketing-communications capability is out of scope here).

## 5. Personas

All personas as recipients; [Denise (Dispatcher)](../00-overview/user-personas.md) as an implicit "operations" recipient for alerts (e.g., unacknowledged dispatch).

## 6. User stories

See [User Stories](../01-product/user-stories.md); plus: As a Customer, I want to choose email over SMS for reminders, so I'm not charged for texts on my plan.

## 7. Functional requirements

Consume domain events (see [Event-Driven Architecture](../02-architecture/event-driven-architecture.md)) and render/send the appropriate templated notification per recipient's channel preference; per-User/Contact notification preference management; delivery-status tracking (sent, delivered, bounced/failed).

## 8. Business rules

A notification is never the sole mechanism for a critical operational fact to reach a user — e.g., a Dispatcher must still be able to see unacknowledged-dispatch state on the schedule board even if the underlying SMS to the Technician failed, per [Dispatch](../03-domain/dispatch.md). Notification delivery failure never blocks the underlying business operation (see [Integration Architecture](../02-architecture/integration-architecture.md), resilience patterns).

## 9. State machines

Notification delivery status: `queued → sent → delivered/bounced/failed`.

## 10. Data requirements

`notifications` (send log), `notification_preferences` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/PATCH /api/v1/notification-preferences`, `GET /api/v1/notifications` (in-app notification center, staff-facing).

## 12. Permission requirements

Each User/Contact manages only their own preferences; Admin/Owner can view organization-wide delivery-failure reports for operational troubleshooting.

## 13. UI requirements

Notification preference settings page (per event type, per channel); in-app notification bell/center for staff; SMS/email templates branded with the Organization's identity where the recipient is a Customer.

## 14. Notifications

(This module *is* Notifications — see the [Event Catalog](../02-architecture/event-driven-architecture.md#event-catalog-launch-scope) for the full producer/consumer mapping across every other module.)

## 15. Audit requirements

Every notification send attempt (success or failure) is logged in `notifications`; this log, distinct from [Audit Events](../03-domain/audit-events.md), is the operational delivery record — but a notification-preference *change* (a state-changing user action) does produce a standard Audit Event.

## 16. Error cases

Third-party delivery failure (Twilio/Resend error) — retried per [Integration Architecture](../02-architecture/integration-architecture.md) resilience patterns, then marked `failed` and surfaced in an Admin-visible delivery-failure report rather than silently dropped.

## 17. Edge cases

A recipient has disabled a given event type entirely — the event still occurs and is still recorded (e.g., the Job still dispatches), only the notification send is skipped; disabling notifications never disables the underlying business action. A phone number is invalid/unreachable — the system falls back to the recipient's email channel if one is on file and the event supports it, rather than failing silently.

## 18. Acceptance criteria

**Given** a Customer with SMS disabled and email enabled for "technician en route," **when** the Technician marks en route, **then** an email is sent and no SMS is attempted.

## 19. Testing requirements

Preference-respecting-delivery tests; retry/fallback-channel tests; delivery-failure-visibility tests (mocked Twilio/Resend failures surface correctly in the Admin report).

## 20. Future extensions

In-app real-time notification delivery via Supabase Realtime (justified narrow use — see [ADR](../02-architecture/architecture-principles.md) principle 4); weekly digest emails; two-way SMS (Customer replies handled).
