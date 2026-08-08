# Warranties — PRD

## 1. Purpose

Track coverage records tied to Assets, so staff know whether a repair should be billed, claimed under warranty, or covered by contractor labor warranty. See [Warranties](../03-domain/warranties.md).

## 2. Business problem

Warranty status is currently tracked, if at all, on paper cards that get lost — leading to businesses either eating the cost of work that should have been a covered claim, or (worse) billing a customer for work that was actually still under warranty.

## 3. Goals

- Every known Warranty is recorded against its Asset and visible to the Technician before they quote a repair.
- Expired/active status is always accurate without manual upkeep.
- A Job performed under warranty is clearly distinguished from a billable Job.

## 4. Non-goals

- Automated manufacturer warranty registration — Phase 5, see [Manufacturers PRD](./manufacturers-prd.md).

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md) (checks/records), [Priya (Accountant)](../00-overview/user-personas.md) (billing implications).

## 6. User stories

As a Technician arriving at a repair, I want to immediately see if the failed Asset is still under warranty, so I quote the customer correctly the first time.

## 7. Functional requirements

CRUD for Warranties against an Asset; computed active/expired display; link a Job to a Warranty when work is performed under coverage.

## 8. Business rules

Full detail in [Warranties](../03-domain/warranties.md) — notably: `expired` status is computed from `coverage_end`, not manually maintained; multiple Warranties can apply to one Asset simultaneously.

## 9. State machines

See [Warranties](../03-domain/warranties.md#state-machine) for the `active → expired (computed) / claimed / voided` diagram.

## 10. Data requirements

`warranties` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH /api/v1/assets/{id}/warranties`, `POST /api/v1/warranties/{id}/claim`, `POST /api/v1/warranties/{id}/void`.

## 12. Permission requirements

Same visibility as parent [Asset](./assets-prd.md) — Technicians can view/record Warranties on assigned Jobs' Assets.

## 13. UI requirements

Warranty badge/indicator on the Asset detail page and surfaced prominently in the Job detail view when the Job references a warrantied Asset; Warranty entry form with coverage dates and terms summary.

## 14. Notifications

Warranty expiring soon (configurable lead time, e.g., 30 days) alert to staff — relevant for proactive maintenance outreach even though full predictive maintenance is Phase 3 scope.

## 15. Audit requirements

Every Warranty create/update/claim/void produces an [Audit Event](../03-domain/audit-events.md) — relevant for manufacturer claim disputes.

## 16. Error cases

Filing a claim against an already-`expired` Warranty (`409`); voiding a Warranty without a reason (`422`).

## 17. Edge cases

A Warranty's manufacturer terms change (e.g., a recall extends coverage) — handled by adding a new Warranty record referencing the update, not by editing the original's `coverage_end` in place, preserving what was true at each point in time for any disputes about coverage at the time work was performed.

## 18. Acceptance criteria

**Given** an Asset with a Warranty whose `coverage_end` is in the future, **when** a Technician views the Asset, **then** it displays as "Under Warranty," and the figure updates to "Expired" automatically the day after `coverage_end` passes, with no manual action required.

## 19. Testing requirements

Computed-status tests across the `coverage_end` boundary; claim/void action tests; notification-scheduling tests for expiring-soon alerts.

## 20. Future extensions

Phase 5 automated registration and manufacturer-side claim submission; predictive "this asset's warranty is expiring, consider a maintenance visit" outreach (Phase 3).
