# User Stories

Stories are grouped by module and reference the [User Personas](../00-overview/user-personas.md) and [Functional Requirements](./functional-requirements.md) they satisfy. Each module PRD in [`06-modules/`](../06-modules/) contains the complete story set for that module; this document lists the launch-critical stories used for scope validation.

## Identity & Organization
- As **Maria (Owner)**, I want to create my Organization and invite my team, so that everyone works from one system. → [Identity PRD](../06-modules/identity-prd.md)
- As **Maria (Owner)**, I want to assign Roles to each team member, so that a Technician cannot see company-wide financials. → [Organization PRD](../06-modules/organization-prd.md)

## CRM & Properties
- As **Denise (Dispatcher)**, I want to search for a Customer by name, phone, or address, so that I can quickly find who's calling. → [Customers PRD](../06-modules/customers-prd.md)
- As **Denise (Dispatcher)**, I want to attach a new Job to an existing Property, so that its service history stays in one place. → [Properties PRD](../06-modules/properties-prd.md)
- As **Curtis (Technician)**, I want to see the Assets already installed at a Property, so that I don't have to ask the customer what equipment they have. → [Assets PRD](../06-modules/assets-prd.md)

## Jobs, Scheduling, Dispatch
- As **Denise (Dispatcher)**, I want to see all Technicians' schedules on one board, so that I can fill gaps without double-booking. → [Scheduling PRD](../06-modules/scheduling-prd.md)
- As **Curtis (Technician)**, I want to receive a push notification with the Job, Property, and directions when I'm dispatched, so that I don't have to call the office. → [Dispatch PRD](../06-modules/dispatch-prd.md)
- As **Curtis (Technician)**, I want a Job-Type-specific checklist, so that I don't forget required diagnostic steps. → [Jobs PRD](../06-modules/jobs-prd.md)

## Estimates, Invoicing, Payments
- As **Curtis (Technician)**, I want to build an Estimate on-site and have the customer approve it on my phone, so that I can start the work immediately. → [Estimates PRD](../06-modules/estimates-prd.md)
- As **Priya (Bookkeeper)**, I want an Invoice to generate automatically from a completed Job, so that I never have to re-key line items. → [Invoicing PRD](../06-modules/invoicing-prd.md)
- As **the Customer**, I want to pay my Invoice online with a card, so that I don't need to mail a check. → [Payments PRD](../06-modules/payments-prd.md)

## Inventory
- As **Curtis (Technician)**, I want to add a part I used to the Job and have it come out of my truck stock, so that inventory stays accurate without manual counts. → [Inventory PRD](../06-modules/inventory-prd.md)

## Documents
- As **Curtis (Technician)**, I want to take before/after photos and attach them to the Job, so that there's proof of work and equipment condition. → [Documents PRD](../06-modules/documents-prd.md)

## Customer Portal
- As **a commercial property manager**, I want to see all my properties and their open Jobs in one portal, so that I don't have to call for status updates. → [Customer Portal PRD](../06-modules/customer-portal-prd.md)

## Notifications
- As **the Customer**, I want a text when my Technician is on the way, so that I know when to be home. → [Notifications PRD](../06-modules/notifications-prd.md)

## Reporting
- As **Maria (Owner)**, I want a weekly dashboard of revenue and technician utilization, so that I know if the business is healthy without doing the math myself. → [Analytics PRD](../06-modules/analytics-prd.md)

## Story format and traceability

All stories follow: *As a [Persona], I want [capability], so that [outcome].* Every story must map to at least one Functional Requirement in [Functional Requirements](./functional-requirements.md) and be verifiable via [Acceptance Criteria](./acceptance-criteria.md).
