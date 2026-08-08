# Phase 2: Core Operations

> **Technical Implementation Phase 2 of 7 — Core Operations Build.** Implements: **Strategic Product Phase 1 — Core Operations.** See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md) for the authoritative distinction between Strategic Product Phases, Technical Implementation Phases, and Sprints. This Technical Phase is broken into [Sprint 0](./sprint-0.md) through Sprint 7 — see [ROADMAP-DECISION.md](./ROADMAP-DECISION.md), Section C.

## Goal

Deliver the complete operational backbone — everything a field-service business needs to replace its current tools and run its day-to-day business inside Atlas. This is the **launch** milestone. See [Product Strategy](../01-product/product-strategy.md).

## Scope (in build order, though with substantial parallelism across a larger team)

1. **CRM**: Customers, Contacts — see [Customers PRD](../06-modules/customers-prd.md), [CRM PRD](../06-modules/crm-prd.md).
2. **Properties & Assets**: Properties, Buildings, Rooms, Assets, the Property-Customer association model — see [Properties PRD](../06-modules/properties-prd.md), [Assets PRD](../06-modules/assets-prd.md).
3. **Jobs, Scheduling, Dispatch**: Job Types/checklists, the Job state machine, the scheduling board, dispatch flow — see [Jobs PRD](../06-modules/jobs-prd.md), [Scheduling PRD](../06-modules/scheduling-prd.md), [Dispatch PRD](../06-modules/dispatch-prd.md).
4. **Estimates, Invoicing, Payments**: the full quote-to-cash flow, Stripe integration — see [Estimates PRD](../06-modules/estimates-prd.md), [Invoicing PRD](../06-modules/invoicing-prd.md), [Payments PRD](../06-modules/payments-prd.md).
5. **Inventory & Suppliers (basic)**: stock tracking, manual purchase orders — see [Inventory PRD](../06-modules/inventory-prd.md), [Suppliers PRD](../06-modules/suppliers-prd.md).
6. **Documents**: photo/form capture and attachment — see [Documents PRD](../06-modules/documents-prd.md).
7. **Mobile (PWA)**: the Technician field experience — see [Mobile PRD](../06-modules/mobile-prd.md).
8. **Customer Portal**: Estimate approval, Invoice payment, service history — see [Customer Portal PRD](../06-modules/customer-portal-prd.md).
9. **Notifications**: the full event-driven notification catalog — see [Notifications PRD](../06-modules/notifications-prd.md).
10. **Analytics & Reporting (basic)**: owner dashboards, exports — see [Analytics PRD](../06-modules/analytics-prd.md), [Reporting PRD](../06-modules/reporting-prd.md).
11. **Integrations (basic)**: QuickBooks Online sync — see [Integrations PRD](../06-modules/integrations-prd.md).

## Dependencies

Requires Technical Implementation Phase 1 ([Phase 1: Foundation](./phase-1-foundation.md)) complete — every entity in this phase is tenant-scoped and Role-gated using that phase's identity/permission infrastructure. See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md), Section D, for the full Sprint-level dependency graph within this Technical Phase.

## Internal sequencing rationale

CRM and Properties/Assets come first because Jobs cannot exist without a Customer and Property to reference (see [Jobs](../03-domain/jobs.md), Business Rules). Estimates/Invoicing/Payments follow Jobs because they're generated from completed Jobs. Mobile and Customer Portal are built once their underlying data model (Jobs, Estimates, Invoices) is stable, not in parallel from day one, to avoid building UI against a moving data contract.

## Exit criteria (launch readiness)

- Every [User Journey](../00-overview/user-journeys.md) (1 through 4) works end to end in Staging.
- Every [Acceptance Criteria](../01-product/acceptance-criteria.md) system-level criterion passes.
- The [Security Testing](../09-testing/security-testing.md) checklist passes with no unresolved high-severity findings.
- [Success Metrics](../01-product/success-metrics.md) activation/Core-Operations-health metrics are instrumented and reporting correctly (even before real usage data exists to evaluate against).

## Explicitly out of scope for this phase

Strategic Phases 2–6 in full (Property Intelligence, Supplier Marketplace, Manufacturer Integrations, Financial Services, Industry Data Network), and any AI-assisted feature beyond what's documented as draft-only in [AI Platform PRD](../06-modules/ai-platform-prd.md) (itself not launch scope). See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md), Section F.

## Related documents

[ROADMAP-DECISION.md](./ROADMAP-DECISION.md) · [Implementation Roadmap](./implementation-roadmap.md) · [Product Scope](../01-product/product-scope.md) · [Domain Overview](../03-domain/domain-overview.md)
