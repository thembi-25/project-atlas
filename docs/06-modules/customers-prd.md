# Customers — PRD

## 1. Purpose

Manage Customer and Contact records: creation, search, editing, and the relationship to Properties over time.

## 2. Business problem

Office staff need to quickly create or find a Customer record while on the phone with them, and need Customer records to correctly reflect commercial accounts with multiple properties and multiple points of contact — not just single-address residential relationships.

## 3. Goals

- Sub-second Customer lookup during a live phone call.
- Correct modeling of commercial accounts (one Customer, many Properties, many Contacts).
- No loss of Property history when a Customer relationship ends.

## 4. Non-goals

- Cross-Organization Customer identity sharing — see [Customers](../03-domain/customers.md), Business Rules.

## 5. Personas

[Denise (Dispatcher)](../00-overview/user-personas.md), [Priya (Accountant)](../00-overview/user-personas.md) for billing-address accuracy.

## 6. User stories

- As a Dispatcher, I want to create a new Customer in under 30 seconds while on a call, so I don't keep the caller waiting.
- As a Dispatcher, I want to see all Properties tied to a commercial Customer, so I can ask "which building?" correctly.
- As an Accountant, I want a Customer's billing address distinct from any Property's service address.

## 7. Functional requirements

See [Customers](../03-domain/customers.md), Data Requirements and API Requirements; plus: quick-create flow (name + phone/address only, other fields optional); merge-duplicate-detection prompt at creation (does not auto-merge — see Business Rules).

## 8. Business rules

Full detail in [Customers](../03-domain/customers.md) — notably, deleting a Customer with any non-deleted Job/Estimate/Invoice is blocked; a Property may be linked to more than one Customer over time.

## 9. State machines

None — Customer has no status state machine at launch beyond soft-deletion.

## 10. Data requirements

`customers`, `contacts`, `property_customer_associations` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH/DELETE /api/v1/customers`, `GET/POST/PATCH/DELETE /api/v1/customers/{id}/contacts`, `GET /api/v1/customers/{id}/properties`.

## 12. Permission requirements

Dispatcher/Admin/Owner: read/write. Technician: read-only, scoped to assigned Jobs' Customers. Accountant: read/write on billing fields, read-only otherwise.

## 13. UI requirements

Quick-create modal (accessible from the global "+ New" action and from Job creation); Customer detail page with Properties/Contacts/Jobs/Financials tabs.

## 14. Notifications

None directly; Customer-facing notifications are triggered by Jobs/Estimates/Invoices, not Customer record changes themselves.

## 15. Audit requirements

All Customer/Contact create/update/delete produce [Audit Events](../03-domain/audit-events.md), including billing-address changes specifically flagged given their financial relevance.

## 16. Error cases

Deleting a Customer with active Jobs (`409`); setting two Contacts as primary simultaneously (`422`, enforced by partial unique constraint — see [Constraints](../04-database/constraints.md)).

## 17. Edge cases

A residential Customer becomes a commercial account (adds a second Property under a new business name) — handled by adding a Property and Contact, not by changing Customer `type` destructively, since historical data referencing the original type/name must remain coherent. A Customer requests to be a "do not contact" — modeled as a per-Contact notification preference, not a Customer-wide delete.

## 18. Acceptance criteria

**Given** a commercial Customer with 5 Properties, **when** staff view the Customer detail page, **then** all 5 Properties and their most recent Job are listed without needing to navigate away.

## 19. Testing requirements

Integration tests for quick-create, Contact primary-uniqueness, and soft-delete blocking with active Jobs; RLS tests for tenant isolation.

## 20. Future extensions

Customer segmentation/tags-driven views; duplicate-merge tooling (deliberately deferred — see [Customers](../03-domain/customers.md), Business Rules, on why merging isn't auto-resolved).
