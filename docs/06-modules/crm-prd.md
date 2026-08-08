# CRM — PRD

## 1. Purpose

CRM covers the shared capabilities across [Customers](../03-domain/customers.md) and [Contacts](../03-domain/contacts.md): search, tagging/notes, and the relationship views staff use to understand who they're working with. This PRD is the umbrella for cross-cutting CRM behavior; entity-specific detail lives in [Customers PRD](./customers-prd.md).

## 2. Business problem

Staff currently rely on memory or a separate spreadsheet to recall a customer's history, preferences, or quirks (gate codes, past complaints, preferred technician) — leading to repeated questions and occasional service mistakes.

## 3. Goals

- Fast, typo-tolerant search across Customers/Contacts by name, phone, address.
- A unified view of a Customer's full relationship: Properties, Jobs, Estimates, Invoices in one place.
- Lightweight tagging/notes without a heavyweight CRM feature set the target segment doesn't need.

## 4. Non-goals

- Marketing automation, lead scoring, or sales pipeline management — Atlas is not a sales CRM; it manages existing service relationships, not prospecting. See [Product Scope](../01-product/product-scope.md).

## 5. Personas

[Denise (Dispatcher)](../00-overview/user-personas.md) primarily, [Maria (Owner)](../00-overview/user-personas.md) for relationship overview.

## 6. User stories

See [User Stories](../01-product/user-stories.md), CRM & Properties section.

## 7. Functional requirements

- Global search bar returning matching Customers, Contacts, Properties, and Jobs ranked by relevance.
- Customer detail view aggregating linked Properties, Jobs, Estimates, Invoices, and notes.
- Free-form tags and staff notes on a Customer, visible only to staff (never Customer Portal-visible).

## 8. Business rules

See [Customers](../03-domain/customers.md) and [Contacts](../03-domain/contacts.md) Business Rules.

## 9. State machines

None at this cross-cutting level — see [Customers PRD](./customers-prd.md).

## 10. Data requirements

Reuses `customers`, `contacts`, plus the `search_vector` generated columns described in [Search Strategy](../02-architecture/search-strategy.md).

## 11. API requirements

`GET /api/v1/search?q=...&types=customers,contacts,properties,jobs` — a unified search endpoint; see [Filtering](../05-api/filtering.md) for the `[search]` filter pattern used on individual collection endpoints.

## 12. Permission requirements

Same as [Customers](./customers-prd.md)/[Contacts](../03-domain/contacts.md).

## 13. UI requirements

Persistent global search bar in the app header; Customer detail page with tabs for Properties/Jobs/Financials/Notes.

## 14. Notifications

None specific to this module beyond what's defined per entity.

## 15. Audit requirements

Note/tag edits produce [Audit Events](../03-domain/audit-events.md); search queries themselves are not audited (not a state change).

## 16. Error cases

Search query below minimum length (e.g., 2 characters) returns an empty result set rather than an error, to keep the UI simple.

## 17. Edge cases

A search term matching a Customer in one module and a Property address in another — results are grouped by type, not merged into one ambiguous list.

## 18. Acceptance criteria

**Given** a Dispatcher typing a partial phone number, **when** they search, **then** matching Customers/Contacts appear within 400ms (see [Non-Functional Requirements](../01-product/non-functional-requirements.md)).

## 19. Testing requirements

Search relevance/performance tests at realistic data volume (thousands of Customers per Organization); permission tests confirming Technicians cannot search outside their assigned Jobs' Customers.

## 20. Future extensions

Saved searches/smart lists; customer segmentation for future maintenance-reminder campaigns (ties to Property Intelligence, [Strategic Phase 2](../13-roadmap/phase-3-property-intelligence.md)).
