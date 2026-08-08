# Properties — PRD

## 1. Purpose

Manage Properties, Buildings, and Rooms as durable, first-class records — the structural foundation of the Property Intelligence pillar. See [Properties](../03-domain/properties.md).

## 2. Business problem

Today, "the property" only exists as a line on an invoice or a scheduling address — there's no persistent record a Technician can consult to know what's already installed or what happened on the last three visits, especially when the current Customer relationship is new (e.g., a home just sold).

## 3. Goals

- Every Property has a durable identity independent of any one Customer relationship.
- Staff and Technicians can see full service history for a Property regardless of which Customer association was active at the time.
- Buildings/Rooms provide precision for commercial and complex residential Properties without burdening simple ones.

## 4. Non-goals

- Public/MLS-style property data enrichment (square footage, year built from third-party data sources) — not integrated at launch; fields are staff-entered only.

## 5. Personas

[Denise (Dispatcher)](../00-overview/user-personas.md), [Curtis (Technician)](../00-overview/user-personas.md).

## 6. User stories

See [User Stories](../01-product/user-stories.md), CRM & Properties section; plus: As a Technician, I want to see a Property's full Job history including work done before the current Customer moved in, so I understand the equipment's real age and condition.

## 7. Functional requirements

CRUD for Properties/Buildings/Rooms; service-history read endpoint; Property-to-Customer association management (add/end an association without deleting the Property).

## 8. Business rules

Full detail in [Properties](../03-domain/properties.md) — the load-bearing rule: Property identity and history are independent of Customer association.

## 9. State machines

None beyond soft-deletion; `property_customer_associations` rows transition via `effective_from`/`effective_to`, not a formal state machine.

## 10. Data requirements

`properties`, `property_customer_associations`, `buildings`, `rooms` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH/DELETE /api/v1/properties`, `GET /api/v1/properties/{id}/history` (Jobs + Assets, all-time), `POST /api/v1/properties/{id}/customer-associations`.

## 12. Permission requirements

Dispatcher/Admin/Owner: read/write. Technician: read-only, scoped to Properties tied to assigned Jobs.

## 13. UI requirements

Property detail page with address, access notes, Buildings/Rooms tree, Asset list, and a chronological service-history timeline spanning all Customer associations.

## 14. Notifications

None directly tied to Property records themselves.

## 15. Audit requirements

Property/Building/Room create/update/delete and every `property_customer_associations` change produce [Audit Events](../03-domain/audit-events.md) — the association history itself is a compliance-relevant record (who's the customer of record and since when).

## 16. Error cases

Deleting a Property with active Jobs/Assets (`409`); creating a duplicate address without acknowledging the duplicate-detection prompt (`422` with a `possible_duplicate` detail).

## 17. Edge cases

A Property is subdivided (one commercial parcel becomes two separately-managed properties) — modeled as creating a new Property and manually re-associating relevant future Jobs; historical Jobs remain on the original Property record, since retroactively splitting history would falsify what actually happened operationally.

## 18. Acceptance criteria

**Given** a Property whose Customer association changed 6 months ago, **when** a Technician opens the Property's service history, **then** Jobs performed under both the prior and current Customer association are visible in one continuous timeline.

## 19. Testing requirements

Integration tests for association add/end without data loss; tests confirming service-history queries return complete history regardless of association period; RLS tests.

## 20. Future extensions

Predictive maintenance signals surfaced on the Property timeline (Phase 3, [Roadmap Phase 3](../13-roadmap/phase-3-property-intelligence.md)); geocoding/routing-aware address enrichment.
