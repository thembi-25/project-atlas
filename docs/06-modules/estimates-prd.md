# Estimates — PRD

## 1. Purpose

Enable staff/Technicians to build priced proposals and get Customer approval before billable work is authorized. See [Estimates](../03-domain/estimates.md).

## 2. Business problem

Field businesses lose money either by doing unapproved extra work they can't bill for, or by losing trust with customers surprised by a bill they didn't agree to — a structured, provably-approved Estimate solves both.

## 3. Goals

- Build and present an Estimate from a Technician's phone in under 2 minutes.
- Get a legally meaningful Customer approval (signature or Portal click) tied to the exact line items shown.
- Convert an approved Estimate into billable work with zero re-entry.

## 4. Non-goals

- Multi-tier negotiation/redlining workflows for large commercial contracts — Atlas supports "good/better/best" multiple Estimates, not a negotiated-contract workflow.

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md) (creates on-site), the Customer (approves).

## 6. User stories

See [User Stories](../01-product/user-stories.md); plus: As a Customer, I want to see exactly what I'm approving with a clear total before I sign, so there are no surprises on the invoice.

## 7. Functional requirements

Line-item builder (from Inventory Items or free-text); send to Customer (Portal link, or in-person signature capture); approve/reject actions; convert-to-invoice action; multi-Estimate support per Job.

## 8. Business rules

Full detail in [Estimates](../03-domain/estimates.md) — notably: totals always derive from line items; a sent Estimate's line items are immutable (edits create a new version); expired Estimates cannot be approved.

## 9. State machines

See [Estimates](../03-domain/estimates.md#state-machine) for the full `draft → sent → approved/rejected/expired → converted` diagram.

## 10. Data requirements

`estimates`, `estimate_line_items` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH /api/v1/estimates` (PATCH only while `draft`), `POST /api/v1/estimates/{id}/send`, `POST /api/v1/estimates/{id}/approve`, `POST /api/v1/estimates/{id}/reject`, `POST /api/v1/estimates/{id}/convert`.

## 12. Permission requirements

Technician: create/send/manage Estimates on assigned Jobs. Dispatcher: read-only. Accountant/Admin/Owner: full access.

## 13. UI requirements

Mobile line-item builder with Inventory Item search/autocomplete; in-person signature capture screen; Customer Portal approve/reject view with clear line-item breakdown.

## 14. Notifications

Estimate sent (to Customer), Estimate approved/rejected (to staff/Technician) — see [Notifications PRD](./notifications-prd.md).

## 15. Audit requirements

Every Estimate creation, send, approval/rejection, and version change produces an [Audit Event](../03-domain/audit-events.md), including capturing the approving party (Contact or in-person signature).

## 16. Error cases

Approving an expired Estimate (`409`, must be resent as a fresh version); editing line items on a `sent` Estimate (`409`, must create a new version instead).

## 17. Edge cases

A Customer approves an Estimate, but the Technician discovers additional required work once they start — handled by creating a *new* Estimate for the additional scope (requiring its own approval), never by silently expanding the already-approved one, preserving the integrity of what was actually agreed to.

## 18. Acceptance criteria

**Given** an Estimate approved by the Customer, **when** staff view the Invoice generated from it, **then** the Invoice's line items exactly match the approved Estimate's line items at the moment of approval.

## 19. Testing requirements

State machine transition tests; line-item-immutability-after-send tests; end-to-end test for the full on-site create → approve → convert flow.

## 20. Future extensions

"Good/better/best" side-by-side presentation UI; financing option presentation at approval time (ties to [Roadmap Phase 6](../13-roadmap/phase-6-financial-services.md)).
