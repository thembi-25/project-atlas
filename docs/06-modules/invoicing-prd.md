# Invoicing — PRD

## 1. Purpose

Generate, finalize, and manage Invoices from completed Jobs, ensuring billing accuracy and financial-record integrity. See [Invoices](../03-domain/invoices.md).

## 2. Business problem

Manual invoicing (re-keying line items from a paper ticket into accounting software) is slow, error-prone, and delays cash flow — the median small field-service business waits too long between job completion and getting paid.

## 3. Goals

- An Invoice generates automatically from a completed Job/approved Estimate with zero re-entry.
- Finalized Invoices are trustworthy, immutable financial records.
- Staff can track outstanding balances and send reminders without manual spreadsheet tracking.

## 4. Non-goals

- General ledger/full double-entry accounting — Atlas produces Invoices and exports to accounting software (see [Integrations PRD](./integrations-prd.md)); it is not a replacement for QuickBooks-style bookkeeping.

## 5. Personas

[Priya (Accountant)](../00-overview/user-personas.md) primarily, [Curtis (Technician)](../00-overview/user-personas.md) for simple on-site invoice generation.

## 6. User stories

See [User Stories](../01-product/user-stories.md); plus: As an Accountant, I want overdue Invoices flagged automatically, so I know who to follow up with without manually checking due dates.

## 7. Functional requirements

Generate Invoice from a completed Job/approved Estimate; finalize/send/void actions; Credit Note issuance against a finalized Invoice; aging report (see [Analytics PRD](./analytics-prd.md)).

## 8. Business rules

Full detail in [Invoices](../03-domain/invoices.md) — notably: immutability once finalized; `amount_paid`/`balance_due` always derived from Payments; gap-free sequential `invoice_number` per Organization.

## 9. State machines

See [Invoices](../03-domain/invoices.md#state-machine) for the full `draft → finalized → sent → partially_paid/paid` (+ `void`) diagram.

## 10. Data requirements

`invoices`, `invoice_line_items`, `credit_notes` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH /api/v1/invoices` (PATCH only while `draft`), `POST /api/v1/invoices/{id}/finalize`, `POST /api/v1/invoices/{id}/send`, `POST /api/v1/invoices/{id}/void`, `POST /api/v1/invoices/{id}/credit-notes`.

## 12. Permission requirements

Technician: create draft Invoices on their completed Jobs (finalization may be gated to Accountant/Admin approval per Organization setting). Accountant/Admin/Owner: full access including void/credit note. Dispatcher: read-only.

## 13. UI requirements

Invoice list with status/aging filters; Invoice detail with a clear "immutable, finalized" visual indicator; Credit Note issuance flow requiring a reason.

## 14. Notifications

Invoice finalized/sent (to Customer), Invoice overdue reminder (scheduled, to Customer and internally to Accountant) — see [Notifications PRD](./notifications-prd.md).

## 15. Audit requirements

Every Invoice draft edit, finalization, send, void, and Credit Note produces an [Audit Event](../03-domain/audit-events.md) — finalization and void are treated as high-sensitivity events given their financial/legal weight.

## 16. Error cases

Attempting to edit a finalized Invoice's line items (`409`, must use a Credit Note); finalizing an Invoice for a Job that isn't `completed` and isn't a flagged deposit Invoice (`422`).

## 17. Edge cases

A Customer disputes a charge after payment — resolved via a Credit Note plus a linked refund [Payment](../03-domain/payments.md), never by altering the original Invoice, preserving what was actually billed and paid at each point in time. A deposit/progress Invoice for a large job — modeled as an explicitly deposit-flagged Invoice type, with the final Invoice referencing and netting against it.

## 18. Acceptance criteria

See [Acceptance Criteria](../01-product/acceptance-criteria.md), Financial immutability; plus: **Given** a fully paid Invoice, **when** any user queries its `balance_due`, **then** the value is exactly zero and matches the sum of linked non-refunded Payments.

## 19. Testing requirements

Immutability-enforcement tests (direct edit attempts on finalized Invoices rejected at both application and database trigger layers — see [Constraints](../04-database/constraints.md)); sequential-numbering gap-free tests; Credit Note math tests.

## 20. Future extensions

Recurring/subscription-style Invoicing for maintenance contracts; multi-currency support (ties to internationalization, currently out of scope per [Product Scope](../01-product/product-scope.md)).
