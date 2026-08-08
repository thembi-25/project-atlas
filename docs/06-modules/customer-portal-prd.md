# Customer Portal — PRD

## 1. Purpose

Give Customers/Contacts self-service access to their Properties, Jobs, Estimates, and Invoices — approving work and paying bills without calling the office. See [Customer Portal](../00-overview/user-journeys.md), Journey 4.

## 2. Business problem

Customers today have no visibility into job status or billing without calling, generating avoidable inbound call volume for office staff and delaying estimate approvals and payments.

## 3. Goals

- A Contact can see everything relevant to them (their Properties, Jobs, Estimates, Invoices) in one place.
- Estimate approval and Invoice payment happen without staff involvement.
- Portal access is safe, scoped precisely to what that Contact should see (never another Customer's data, never internal staff notes).

## 4. Non-goals

- Customer-initiated job scheduling/booking (self-service appointment booking) — not launch scope; Customers request work via phone/existing channels and see status once staff create the Job. Candidate future extension.

## 5. Personas

The Customer / Contact — see [User Personas](../00-overview/user-personas.md), persona 5.

## 6. User stories

See [User Stories](../01-product/user-stories.md); plus: As a residential customer, I want to see the history of work done at my home, so I have a record for resale/insurance purposes without calling the company.

## 7. Functional requirements

Magic-link/email-based portal login (no password account, distinct from staff auth — see [Contacts](../03-domain/contacts.md)); view Properties/Jobs/Estimates/Invoices; approve/reject Estimates; pay Invoices; download PDFs.

## 8. Business rules

Portal access is per-Contact (`portal_access_enabled`), not per-Customer; a Contact only ever sees data belonging to their own Customer record — enforced by the same RLS mechanism as staff access, using a Contact-specific policy checking `contacts.portal_user_id = auth.uid()` joined through `customer_id`, distinct from the Membership-based policies used for staff. See [Tenant Isolation](../07-security/tenant-isolation.md).

## 9. State machines

None independent of [Estimates](../03-domain/estimates.md)/[Invoices](../03-domain/invoices.md) — the Portal is a scoped view/action surface on those existing state machines.

## 10. Data requirements

Reuses `contacts.portal_user_id`/`portal_access_enabled`; no separate Portal-specific tables beyond authentication linkage.

## 11. API requirements

Portal endpoints live under a distinct, more restrictive auth/permission path (e.g., `/api/v1/portal/*`) rather than reusing staff endpoints directly, so Portal-specific scoping is explicit and auditable in the routing layer itself, not just in RLS: `GET /api/v1/portal/properties`, `GET /api/v1/portal/jobs`, `POST /api/v1/portal/estimates/{id}/approve`, `POST /api/v1/portal/invoices/{id}/pay`.

## 12. Permission requirements

No Membership Role applies — access is entirely governed by `contacts.portal_access_enabled` plus RLS scoping to that Contact's Customer. Internal staff notes, cost data, and Technician-specific fields are never exposed on `/api/v1/portal/*` responses (verified by output validation — see [Request Validation](../05-api/request-validation.md)).

## 13. UI requirements

A separate, simplified web app surface (not the staff app with hidden menus) — see [ADR-024](../11-adr/ADR-024-mobile-strategy.md) for the shared Next.js app serving both, routed and styled distinctly.

## 14. Notifications

Portal invitation/magic-link email, Estimate ready for approval, Invoice ready for payment — see [Notifications PRD](./notifications-prd.md).

## 15. Audit requirements

Every Portal-initiated action (Estimate approval/rejection, payment) produces an [Audit Event](../03-domain/audit-events.md) with `actor_type = 'contact'` distinct from staff `user` actors.

## 16. Error cases

Magic link expired/already used (`401`, prompts a fresh link request); attempting to access a Job/Property not belonging to the Contact's Customer (`404`, per the same cross-tenant-safe pattern as [Authorization](../05-api/authorization.md)).

## 17. Edge cases

A commercial Customer with 10 Contacts, only 3 with portal access — the other 7 remain visible to staff as regular Contacts with no login capability, not deleted or degraded in any way. A Contact's portal access is revoked mid-session — their next request fails auth immediately, consistent with the live-Membership-state pattern used for staff (see [Multi-Tenancy](../04-database/multi-tenancy.md)).

## 18. Acceptance criteria

**Given** a Contact with portal access for Customer A, **when** they attempt to access any resource belonging to Customer B, **then** the request returns `404`, identical in shape to the staff cross-tenant-isolation guarantee.

## 19. Testing requirements

RLS tests specific to the Contact-scoped policies; end-to-end test for the full magic-link login → view → approve → pay flow; output-validation tests confirming no internal-only fields leak to Portal responses.

## 20. Future extensions

Self-service appointment requests; multi-property bulk approval for commercial property managers; portal-based document upload (e.g., customer-provided access instructions).
