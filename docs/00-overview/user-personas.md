# User Personas

These personas are referenced throughout the module PRDs in [`06-modules/`](../06-modules/). Each persona maps to one or more [Roles](../03-domain/roles.md).

## 1. Owner / Operator — "Maria"

- Runs a 12-technician HVAC company. Often still takes calls and occasionally runs jobs herself.
- Primary Role: **Owner** (full permissions across the Organization).
- Goals: know if the business is profitable this week, not just this quarter; avoid losing jobs to scheduling mistakes; get paid faster.
- Pain today: reconciles technician time, parts cost, and invoicing manually at night.
- Key surfaces: web dashboard (reporting), mobile app (spot-checking field status), never touches raw database or API directly.
- Primary modules: [Analytics PRD](../06-modules/analytics-prd.md), [Reporting PRD](../06-modules/reporting-prd.md), [Invoicing PRD](../06-modules/invoicing-prd.md).

## 2. Dispatcher / Office Manager — "Denise"

- Runs the day-to-day schedule for 8–15 technicians across plumbing and electrical.
- Primary Role: **Dispatcher** (schedule, assign, and communicate jobs; limited financial visibility).
- Goals: fill every technician's day efficiently; respond to same-day emergency calls without double-booking; keep customers informed of arrival windows.
- Pain today: a physical whiteboard or a generic calendar with no property/asset context, plus a group text thread for dispatch.
- Key surfaces: web dispatch board (primary), notifications to technicians.
- Primary modules: [Scheduling PRD](../06-modules/scheduling-prd.md), [Dispatch PRD](../06-modules/dispatch-prd.md), [Notifications PRD](../06-modules/notifications-prd.md).

## 3. Technician — "Curtis"

- Field technician performing 4–8 jobs a day across multiple properties, often in areas with poor cell coverage.
- Primary Role: **Technician** (sees only assigned jobs and the properties/assets/customers tied to them).
- Goals: know what equipment is at the property and what happened last visit before knocking on the door; capture work performed, parts used, and photos quickly; get the customer to approve/pay on the spot.
- Pain today: shows up cold, has to call the office for job history, fills out paper tickets that get lost or re-entered.
- Key surfaces: mobile app (primary and near-exclusive interface).
- Primary modules: [Mobile PRD](../06-modules/mobile-prd.md), [Jobs PRD](../06-modules/jobs-prd.md), [Estimates PRD](../06-modules/estimates-prd.md).

## 4. Bookkeeper / Accountant — "Priya"

- Handles invoicing follow-up, payment reconciliation, and often payroll-adjacent reporting; may be part-time or outsourced.
- Primary Role: **Accountant** (financial modules, limited operational visibility).
- Goals: accurate, timely invoices; clear audit trail for every payment; clean export to accounting software.
- Key surfaces: web app financial views, exports/API for accounting software sync.
- Primary modules: [Invoicing PRD](../06-modules/invoicing-prd.md), [Payments PRD](../06-modules/payments-prd.md), [Integrations PRD](../06-modules/integrations-prd.md).

## 5. Customer — "The Homeowner" / "The Property Manager"

- Two sub-personas: **residential customer** (single property, infrequent jobs) and **commercial property manager** (multiple properties, recurring service contracts).
- Interacts via the Customer Portal, not the main app; no Organization Membership.
- Goals: understand what work is being proposed and why, approve/reject estimates quickly, pay online, see service history for their property.
- Key surfaces: [Customer Portal PRD](../06-modules/customer-portal-prd.md).

## 6. Read-Only / Auditor Role — "External Accountant" or "Insurance Auditor"

- Needs visibility into specific financial or compliance records without operational access.
- Primary Role: **Read Only**.
- Key surfaces: web app, scoped to reporting and export views.

## Future-phase personas (not launch scope)

- **Supplier Rep** — manages product catalog and fulfills marketplace orders. See [Marketplace PRD](../06-modules/marketplace-prd.md).
- **Manufacturer Partner** — manages warranty and product compliance data. See [Manufacturers PRD](../06-modules/manufacturers-prd.md), [Warranties PRD](../06-modules/warranties-prd.md).

These future personas are documented now so the domain model (Roles, Permissions) is not designed in a way that blocks them later — but no UI or workflow is built for them at launch.
