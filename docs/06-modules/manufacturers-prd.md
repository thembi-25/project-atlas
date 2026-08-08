# Manufacturers — PRD

> **Status: Launch scope covers basic reference data; deeper integration is Strategic Phase 4.** See [Strategic Phase 4](../13-roadmap/phase-5-manufacturers.md).

## 1. Purpose

Maintain the platform-shared Manufacturer reference data used by Assets and Warranties, and (Strategic Phase 4) integrate directly with manufacturer systems for warranty registration and product compliance data. See [Manufacturers](../03-domain/manufacturers.md).

## 2. Business problem

Staff currently look up manufacturer warranty terms manually per job; a shared, structured Manufacturer record makes this instant, and (Strategic Phase 4) automatic registration removes a paperwork step technicians often skip entirely.

## 3. Goals

- A reliable, shared Manufacturer directory available to every Organization from day one.
- (Strategic Phase 4) Automated warranty registration and product compliance data exchange with manufacturer partners.

## 4. Non-goals

- Manufacturer-facing partner portal/dashboard — not built until Strategic Phase 4 partnerships are established.

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md) (selects Manufacturer when recording an Asset), a future **Manufacturer Partner** persona (Strategic Phase 4).

## 6. User stories

As a Technician recording a new Asset, I want to select its manufacturer from a searchable list, so the record is accurate without me typing it from scratch every time.

## 7. Functional requirements

Launch: search/select existing platform Manufacturers; add a new Manufacturer scoped to the Organization if not found. Strategic Phase 4: warranty registration API integration, product catalog sync.

## 8. Business rules

Full detail in [Manufacturers](../03-domain/manufacturers.md) — notably: Manufacturers are platform-shared, not Organization-owned; Organization-added Manufacturers can be promoted to platform-verified status.

## 9. State machines

None at launch; `is_platform_verified` is a one-way promotion flag, not a full state machine.

## 10. Data requirements

`manufacturers` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET /api/v1/manufacturers?search=...`, `POST /api/v1/manufacturers` (Organization-scoped addition).

## 12. Permission requirements

Read: all authenticated Roles. Write (add new): any Role with Asset write access. Promotion to platform-verified: platform-admin only, outside Organization RBAC.

## 13. UI requirements

Typeahead search/select in the Asset creation flow; "add new manufacturer" fallback.

## 14. Notifications

None at launch. Strategic Phase 4: warranty registration confirmation notifications.

## 15. Audit requirements

Organization-added Manufacturer creation produces an [Audit Event](../03-domain/audit-events.md); promotion to platform-verified is logged at the platform-admin level.

## 16. Error cases

Adding a Manufacturer that's a near-duplicate of an existing platform entry (`422` with a `possible_duplicate` suggestion, not a hard block, since names legitimately vary).

## 17. Edge cases

Two Organizations independently add the same unlisted Manufacturer with slightly different spelling — both entries persist Organization-scoped until a platform-admin data-quality review merges/promotes one, since Atlas never silently merges data across Organizations.

## 18. Acceptance criteria

**Given** a Technician searching for "Carrier" while recording an Asset, **when** they select it from the platform list, **then** the Asset's `manufacturer_id` references the shared platform record, not a new Organization-scoped duplicate.

## 19. Testing requirements

Search/typeahead tests; cross-Organization shared-read tests (confirming Manufacturers are visible to all Organizations despite RLS being enabled on the table).

## 20. Future extensions

Strategic Phase 4 warranty registration API integrations per manufacturer partner; product catalog/spec sync feeding richer Asset data at creation time.
