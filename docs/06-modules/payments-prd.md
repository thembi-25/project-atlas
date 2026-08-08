# Payments — PRD

## 1. Purpose

Capture and reconcile Customer payments against Invoices, online and in-person, via Stripe. See [Payments](../03-domain/payments.md).

## 2. Business problem

Chasing payment by mailed check or manual card entry over the phone delays cash flow and creates PCI/security exposure if handled outside a proper processor.

## 3. Goals

- A Technician can collect payment on-site the moment a job finishes.
- A Customer can pay online without a phone call.
- Atlas never touches raw card data.

## 4. Non-goals

- Building a payments processor or handling card data directly — Stripe is the processor of record; see [ADR-018](../11-adr/ADR-018-payments.md).

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md) (in-person capture), the Customer (online payment), [Priya (Accountant)](../00-overview/user-personas.md) (reconciliation).

## 6. User stories

See [User Stories](../01-product/user-stories.md); plus: As an Accountant, I want every Payment automatically reconciled against its Invoice, so month-end close doesn't require manual matching.

## 7. Functional requirements

Card-present capture (Stripe Terminal) from mobile; online payment link/Portal payment (Stripe Elements); cash/check manual recording; refund issuance.

## 8. Business rules

Full detail in [Payments](../03-domain/payments.md) — notably: no raw card data stored; idempotency key required on every capture; refunds are new negative-linked records, never mutations.

## 9. State machines

See [Payments](../03-domain/payments.md#state-machine) for the full `pending → completed/failed`, `completed → refunded` diagram.

## 10. Data requirements

`payments` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`POST /api/v1/invoices/{id}/payments` (requires `Idempotency-Key` header), `POST /api/v1/payments/{id}/refund`, `GET /api/v1/invoices/{id}/payments`. Stripe webhook handling per [Webhooks](../05-api/webhooks.md).

## 12. Permission requirements

Technician: capture payments on assigned/completed Jobs only. Accountant/Admin/Owner: full access including refunds. Dispatcher: read-only.

## 13. UI requirements

Mobile card-present capture flow (Stripe Terminal SDK integration); Customer Portal payment form; refund action requiring a reason, restricted to Accountant/Admin/Owner in the UI.

## 14. Notifications

Payment received receipt (to Customer), payment failed alert (to staff for in-person captures), refund confirmation (to Customer) — see [Notifications PRD](./notifications-prd.md).

## 15. Audit requirements

Every Payment attempt (including failures) and every refund produces an [Audit Event](../03-domain/audit-events.md) — Payments are among the highest-scrutiny Audit Events given direct financial impact.

## 16. Error cases

Duplicate capture request with the same idempotency key (returns the original result, does not double-charge — per [Acceptance Criteria](../01-product/acceptance-criteria.md)); refund amount exceeding the original Payment amount (`422`); capture attempt on an already-`paid` Invoice (`409`).

## 17. Edge cases

A card-present capture succeeds with Stripe but the mobile app loses connectivity before confirming — the Stripe webhook (processed by the Worker, see [Webhooks](../05-api/webhooks.md)) is the authoritative source of truth for Payment completion, not the mobile client's in-request response, so the Payment still records correctly even if the Technician's app never sees the success response.

## 18. Acceptance criteria

See [Acceptance Criteria](../01-product/acceptance-criteria.md), Idempotent payment capture; plus: **Given** an Invoice with `total = 500.00` and one `completed` Payment of `300.00`, **when** a Payment of `200.00` is captured, **then** the Invoice status transitions to `paid` and `balance_due` becomes `0.00`.

## 19. Testing requirements

Idempotency tests (concurrent duplicate requests); webhook-driven reconciliation tests (payment confirmed asynchronously after client disconnects); refund math tests; PCI-relevant tests confirming no card data ever reaches Atlas's own logs/database (see [Security Testing](../09-testing/security-testing.md)).

## 20. Future extensions

ACH/bank-transfer payments for larger commercial invoices; Stripe Connect-based faster payouts to the Organization (ties to [Strategic Phase 5](../13-roadmap/phase-6-financial-services.md)); saved payment methods for repeat Customers.
