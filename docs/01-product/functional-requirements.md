# Functional Requirements

This document lists launch-scope (Phase 1–2) functional requirements at a system level. Each module's complete, detailed requirements live in its PRD under [`06-modules/`](../06-modules/); this document is the cross-module summary used to verify scope completeness.

## FR-1: Identity & Access
- FR-1.1 A person can be invited to an Organization by email and accepts to create/link a User account.
- FR-1.2 A User's access within an Organization is governed by exactly one or more Roles via their Membership.
- FR-1.3 A Role's Permissions determine which resources and actions are visible/executable.
- FR-1.4 A User can belong to more than one Organization (e.g., a consultant); data never crosses Organization boundaries regardless of Membership count.
- Detail: [Identity PRD](../06-modules/identity-prd.md), [Organization PRD](../06-modules/organization-prd.md).

## FR-2: Customer & Property Management
- FR-2.1 Staff can create/search/update Customers and their Contacts.
- FR-2.2 Staff can create/search/update Properties, optionally structured into Buildings and Rooms.
- FR-2.3 A Property can be linked to more than one Customer over time (e.g., ownership change) without losing Asset/Job history — see [Properties](../03-domain/properties.md), Business Rules.
- FR-2.4 Staff can record Assets at a Property with type, manufacturer, model, serial number, install date.
- Detail: [Customers PRD](../06-modules/customers-prd.md), [Properties PRD](../06-modules/properties-prd.md), [Assets PRD](../06-modules/assets-prd.md).

## FR-3: Jobs & Scheduling
- FR-3.1 Staff can create a Job tied to a Customer and Property, optionally to specific Assets.
- FR-3.2 A Job Type determines the default checklist/form and expected duration.
- FR-3.3 Staff can schedule a Job to a date/time window and assign one or more Technicians.
- FR-3.4 A Technician can view assigned Jobs, complete checklists, log time, add parts, capture photos.
- FR-3.5 A Job's status transitions follow a defined state machine (see [Jobs](../03-domain/jobs.md), State Machine).
- Detail: [Jobs PRD](../06-modules/jobs-prd.md), [Scheduling PRD](../06-modules/scheduling-prd.md), [Dispatch PRD](../06-modules/dispatch-prd.md).

## FR-4: Estimates, Invoicing, Payments
- FR-4.1 Staff/Technicians can create an Estimate with one or more priced line items, tied to a Job.
- FR-4.2 A Customer can approve/reject an Estimate via the Customer Portal or in-person capture.
- FR-4.3 Completing a Job with an accepted Estimate (or ad hoc line items) generates an Invoice.
- FR-4.4 A Customer can pay an Invoice online or a Technician can capture a card-present/cash payment.
- FR-4.5 Partial payments and payment history are tracked per Invoice.
- Detail: [Estimates PRD](../06-modules/estimates-prd.md), [Invoicing PRD](../06-modules/invoicing-prd.md), [Payments PRD](../06-modules/payments-prd.md).

## FR-5: Inventory
- FR-5.1 Staff can define Inventory Items with SKU, cost, and quantity on hand per location (warehouse/truck).
- FR-5.2 Adding a part to a Job decrements the assigned Technician's/location's stock and records cost against the Job.
- Detail: [Inventory PRD](../06-modules/inventory-prd.md).

## FR-6: Documents
- FR-6.1 Users can attach files/photos to Jobs, Properties, and Assets.
- FR-6.2 Documents are versioned and retain who uploaded them and when.
- Detail: [Documents PRD](../06-modules/documents-prd.md).

## FR-7: Customer Portal
- FR-7.1 A Contact with portal access can log in and see their Properties, open/past Jobs, pending Estimates, and Invoices.
- FR-7.2 A Contact can approve Estimates and pay Invoices without staff involvement.
- Detail: [Customer Portal PRD](../06-modules/customer-portal-prd.md).

## FR-8: Notifications
- FR-8.1 The system sends automated email/SMS notifications for: job scheduled, technician en route, estimate ready, invoice ready, payment received.
- FR-8.2 Users can configure notification preferences per event type and channel.
- Detail: [Notifications PRD](../06-modules/notifications-prd.md).

## FR-9: Reporting
- FR-9.1 Owners/Admins can view dashboards for revenue, job volume, technician utilization, and outstanding invoices, filterable by date range.
- Detail: [Analytics PRD](../06-modules/analytics-prd.md), [Reporting PRD](../06-modules/reporting-prd.md).

## FR-10: Audit
- FR-10.1 Every create/update/delete of a tenant-owned record produces an Audit Event capturing actor, timestamp, entity, and change.
- Detail: [Audit Events](../03-domain/audit-events.md).

## Traceability

Every functional requirement above must be traceable to acceptance criteria in [Acceptance Criteria](./acceptance-criteria.md) and to user stories in [User Stories](./user-stories.md).
