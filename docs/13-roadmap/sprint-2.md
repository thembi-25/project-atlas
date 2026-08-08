# Sprint 2: CRM Foundations (Start of Phase 2)

## Goal

The first customer-facing entities: Customers and Contacts, establishing the pattern (data layer → domain logic → API → UI) that every subsequent Phase 2 module follows. This sprint marks the transition from Phase 1 (Foundation) into Phase 2 (Core Operations).

## Deliverables

1. `customers`, `contacts` tables with RLS, following the established Phase 1 pattern exactly — per [Customers](../03-domain/customers.md), [Contacts](../03-domain/contacts.md).
2. Customer/Contact CRUD API endpoints per [Customers PRD](../06-modules/customers-prd.md) API Requirements.
3. Quick-create Customer flow and Customer detail page (staff web app) — per [Customers PRD](../06-modules/customers-prd.md) UI Requirements.
4. Global search foundation (`search_vector` generated columns, GIN indexes) established on `customers`/`contacts`, extensible to Properties/Jobs in later sprints — per [Search Strategy](../02-architecture/search-strategy.md), [CRM PRD](../06-modules/crm-prd.md).
5. Full test coverage per [Testing Instructions](../12-claude/testing-instructions.md): unit (validation rules), integration (RLS, primary-Contact uniqueness constraint), API (CRUD + permission matrix).

## Exit criteria

Denise (Dispatcher persona) can create a Customer and Contacts, search for them, and see the record reflect the documented business rules (e.g., primary Contact uniqueness, soft-delete blocking with active dependents) — verified end to end, including the specific [Acceptance Criteria](../01-product/acceptance-criteria.md) applicable to this scope.

## What this sprint establishes for later sprints

The full-stack implementation pattern (schema+RLS → domain logic → API → UI → tests) demonstrated here is the template every subsequent Phase 2 module (Properties/Assets, Jobs, Estimates/Invoicing/Payments, Inventory) follows — deviations from this pattern in later sprints should be deliberate and justified, not accidental drift.

## Related documents

[Phase 2: Core Operations](./phase-2-core-operations.md) · [Customers PRD](../06-modules/customers-prd.md) · [CRM PRD](../06-modules/crm-prd.md) · [Sprint 1](./sprint-1.md)
