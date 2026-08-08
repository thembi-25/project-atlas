# Product Scope

## In scope for launch (Technical Implementation Phases 1 + 2 = Strategic Phase 1: Core Operations — see [ROADMAP-DECISION.md](../13-roadmap/ROADMAP-DECISION.md), [Implementation Roadmap](../13-roadmap/implementation-roadmap.md))

### Identity & Organization
- Organization creation and settings, user invitation, Roles/Permissions (Owner, Admin, Dispatcher, Technician, Accountant, Read Only). See [Identity PRD](../06-modules/identity-prd.md), [Organization PRD](../06-modules/organization-prd.md).

### CRM
- Customer and Contact management, service address book, basic customer notes/tags. See [CRM PRD](../06-modules/crm-prd.md), [Customers PRD](../06-modules/customers-prd.md).

### Properties & Assets
- Property records with Buildings/Rooms, Asset records with type, install date, and service history. See [Properties PRD](../06-modules/properties-prd.md), [Assets PRD](../06-modules/assets-prd.md).

### Jobs, Scheduling, Dispatch
- Job creation against a Customer/Property/Asset, configurable Job Types, checklists/forms, scheduling calendar, technician assignment, dispatch notifications. See [Jobs PRD](../06-modules/jobs-prd.md), [Scheduling PRD](../06-modules/scheduling-prd.md), [Dispatch PRD](../06-modules/dispatch-prd.md).

### Estimates, Invoicing, Payments
- Estimate creation/approval, invoice generation from completed jobs, online and card-present payment collection, payment reconciliation. See [Estimates PRD](../06-modules/estimates-prd.md), [Invoicing PRD](../06-modules/invoicing-prd.md), [Payments PRD](../06-modules/payments-prd.md).

### Inventory (basic)
- Truck/warehouse inventory tracking, part consumption on jobs, low-stock visibility. Purchase ordering to Suppliers is basic (manual, non-marketplace) at launch. See [Inventory PRD](../06-modules/inventory-prd.md).

### Documents
- File/photo attachment to jobs, properties, and assets (before/after photos, signed forms). See [Documents PRD](../06-modules/documents-prd.md).

### Customer Portal
- Estimate approval, invoice payment, service history view for the customer. See [Customer Portal PRD](../06-modules/customer-portal-prd.md).

### Mobile
- Technician-facing mobile experience for the full on-site job journey. See [Mobile PRD](../06-modules/mobile-prd.md).

### Notifications
- Email and SMS notifications for scheduling confirmations, dispatch, estimate/invoice events. See [Notifications PRD](../06-modules/notifications-prd.md).

### Reporting/Analytics (basic)
- Owner-facing dashboards: revenue, job volume, technician utilization, outstanding invoices. See [Analytics PRD](../06-modules/analytics-prd.md), [Reporting PRD](../06-modules/reporting-prd.md).

### Integrations (basic)
- Accounting export/sync (QuickBooks Online), calendar export. See [Integrations PRD](../06-modules/integrations-prd.md).

## Explicitly out of scope for launch

- **Supplier Marketplace** (ordering parts through connected suppliers in-app) — Strategic Phase 3. See [Marketplace PRD](../06-modules/marketplace-prd.md).
- **Manufacturer integrations** (warranty registration APIs, product catalog sync) — Strategic Phase 4. See [Manufacturers PRD](../06-modules/manufacturers-prd.md), [Warranties PRD](../06-modules/warranties-prd.md).
- **Financial services** (financing, faster payouts, embedded lending) — Strategic Phase 5.
- **Industry Data Network** (aggregated cross-organization insights) — Strategic Phase 6.
- **Predictive/AI-driven maintenance recommendations** — any AI capability beyond basic assistive drafting is out of scope for launch. See [AI Platform PRD](../06-modules/ai-platform-prd.md) and [ADR-020](../11-adr/ADR-020-ai-architecture.md).
- **Multi-location/franchise billing structures** — out of scope; an Organization is a single tenant, and multi-branch structures within one Organization are a future extension (see [Organization](../03-domain/organization.md), Future Extensions).
- **Payroll processing** — Atlas records technician time on jobs but does not run payroll.
- **New-construction/project-based contracting workflows** (bids, draws, change orders, lien waivers) — not modeled; Atlas is a service/repair workflow product.
- **Native offline-first data sync with conflict resolution** — the mobile app is offline-*tolerant* (can view cached job data and queue actions) but full bidirectional offline sync with conflict resolution is a future extension. See [Mobile PRD](../06-modules/mobile-prd.md), Future Extensions.
- **Non-U.S. tax/currency/compliance support** — U.S.-only at launch.

## Scope boundary principle

If a proposed feature does not clearly belong to Technical Implementation Phase 1 or 2 of the [Implementation Roadmap](../13-roadmap/implementation-roadmap.md), it is out of scope for launch by default and requires an explicit roadmap change, not an ad hoc addition. See [Product Principles](../00-overview/product-principles.md).
