# Mobile — PRD

## 1. Purpose

Define the Technician-facing mobile experience — the primary and near-exclusive interface Technicians use to execute their day. See [Technicians](../03-domain/technicians.md), [User Personas](../00-overview/user-personas.md), persona 3.

## 2. Business problem

Technicians in the field, often with poor connectivity, need fast access to Job/Property/Asset context and a frictionless way to capture checklist completion, photos, Estimates, and payment — a desktop-oriented web app fails this use case.

## 3. Goals

- One-handed usability for every primary action.
- Functional even with poor/intermittent connectivity (offline-tolerant, not full offline sync).
- Fast: job list to job detail to "start work" in as few taps as possible.

## 4. Non-goals

- Full bidirectional offline sync with conflict resolution — see [Product Scope](../01-product/product-scope.md), explicitly out of scope for launch.
- A separate native iOS/Android codebase — see [ADR-024: Mobile Strategy](../11-adr/ADR-024-mobile-strategy.md).

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md).

## 6. User stories

See [User Journeys](../00-overview/user-journeys.md), Journey 2; [User Stories](../01-product/user-stories.md).

## 7. Functional requirements

Today's Job list (offline-cached); Job detail with Property/Asset history, checklist, Documents; on-site Estimate creation and signature capture; payment capture (Stripe Terminal); dispatch acknowledge/en-route/arrived actions.

## 8. Business rules

Inherits the business rules of every module it surfaces (Jobs, Tasks, Estimates, Payments, Documents) — Mobile is a client surface, not an independent domain module; see each linked module's domain document.

## 9. State machines

Mobile surfaces, but does not independently define, the [Jobs](../03-domain/jobs.md), [Estimates](../03-domain/estimates.md), and [Dispatch](../03-domain/dispatch.md) state machines.

## 10. Data requirements

No Mobile-specific tables; a client-side local cache (IndexedDB, via the PWA) mirrors a Technician's assigned Jobs for the current day, explicitly for offline tolerance, never treated as authoritative — see [Caching Strategy](../02-architecture/caching-strategy.md).

## 11. API requirements

Reuses standard `/api/v1/` endpoints; a dedicated `GET /api/v1/jobs?assigned_to=me&date=today` optimized-payload endpoint minimizes data transfer for the primary mobile screen.

## 12. Permission requirements

Standard Technician Role scoping (`jobs:write_assigned`, etc.) — see [Roles](../03-domain/roles.md).

## 13. UI requirements

Delivered as an installable Progressive Web App (PWA) from the same Next.js codebase (see [ADR-024](../11-adr/ADR-024-mobile-strategy.md)) — responsive layout, large touch targets, primary actions reachable within two taps from the Job list (see [Non-Functional Requirements](../01-product/non-functional-requirements.md), NFR-16), camera integration for Documents.

## 14. Notifications

Push notifications for dispatch, schedule changes — see [Notifications PRD](./notifications-prd.md); requires Web Push permission grant during onboarding.

## 15. Audit requirements

No Mobile-specific Audit Events beyond what each underlying action (Job status change, Document upload, Payment capture) already produces.

## 16. Error cases

Action attempted while offline that requires immediate server confirmation (e.g., payment capture) — the UI clearly indicates the action is queued/pending rather than falsely confirming success; see Edge Cases.

## 17. Edge cases

A Technician completes a checklist item while offline — the response is cached locally with a pending-sync indicator and submitted automatically on reconnect; if the same Job was modified by another party (e.g., Dispatcher reassigned it) in the meantime, the sync surfaces a clear conflict notice rather than silently overwriting, since Atlas does not implement automatic conflict resolution (see Non-goals). A Technician's device has zero connectivity for an entire multi-hour Job — Job detail, checklist, and Document capture all function from cache; only server-dependent actions (payment capture, Marketplace ordering) are blocked until reconnect, and are clearly marked as such.

## 18. Acceptance criteria

See [Non-Functional Requirements](../01-product/non-functional-requirements.md), NFR-3; plus: **Given** a Technician with today's Jobs cached locally, **when** their device loses connectivity, **then** they can still view full Job/Property/Asset detail and complete checklist items, with completions queued for sync.

## 19. Testing requirements

Offline-mode end-to-end tests (simulated network loss); sync-on-reconnect tests including the conflict-notice path; touch-target/accessibility audits per NFR-16.

## 20. Future extensions

Full offline sync with conflict resolution; native app wrapper if platform capability needs (e.g., deeper OS-level push reliability) outgrow the PWA approach — see [ADR-024](../11-adr/ADR-024-mobile-strategy.md), Future reconsideration triggers.
