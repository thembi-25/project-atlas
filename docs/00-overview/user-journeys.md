# User Journeys

These are the core end-to-end journeys the launch product (Roadmap Phases 1–2, see [Implementation Roadmap](../13-roadmap/implementation-roadmap.md)) must support. Each references the modules and domain entities involved.

## Journey 1: New customer inquiry to scheduled job

1. Denise (Dispatcher) receives a call from a new customer needing an HVAC repair.
2. She creates a **Customer** record (or finds an existing one) and a **Property** if new, or attaches the job to an existing Property. See [Customers](../03-domain/customers.md), [Properties](../03-domain/properties.md).
3. She creates a **Job**, selecting a **Job Type** (e.g., "HVAC Repair") which determines the default checklist/form and estimated duration. See [Jobs](../03-domain/jobs.md).
4. She checks the **Scheduling** board for technician availability and assigns a time window. See [Scheduling PRD](../06-modules/scheduling-prd.md).
5. The system **Dispatches** the job to Curtis (Technician) via push notification with the job, property, and any known asset history attached. See [Dispatch PRD](../06-modules/dispatch-prd.md).
6. The customer receives an automated confirmation with the arrival window. See [Notifications PRD](../06-modules/notifications-prd.md).

## Journey 2: Technician on-site execution

1. Curtis opens the mobile app, sees today's job list, and taps into the HVAC repair job.
2. He sees the Property's asset history: the condenser installed 6 years ago, last serviced 14 months ago. See [Assets](../03-domain/assets.md).
3. He completes the job's **Checklist/Form** (diagnostic steps specific to the Job Type). See [Jobs PRD](../06-modules/jobs-prd.md).
4. He identifies a failed capacitor, adds a part from **Inventory** to the job, and creates an **Estimate** for the replacement, which the customer approves on his phone. See [Estimates PRD](../06-modules/estimates-prd.md), [Inventory PRD](../06-modules/inventory-prd.md).
5. He completes the repair, marks the Job complete, and the system generates an **Invoice** from the accepted Estimate. See [Invoicing PRD](../06-modules/invoicing-prd.md).
6. The customer pays on-site via the mobile card-present flow or is emailed a payment link. See [Payments PRD](../06-modules/payments-prd.md).
7. Every step (checklist completion, estimate approval, invoice generation, payment) writes an **Audit Event**. See [Audit Events](../03-domain/audit-events.md).

## Journey 3: Office reconciliation and reporting

1. Priya (Bookkeeper) reviews the day's completed jobs and confirms invoices and payments reconcile.
2. She exports the day's financial activity for the accounting system sync. See [Integrations PRD](../06-modules/integrations-prd.md).
3. Maria (Owner) reviews the weekly dashboard: revenue, technician utilization, average job cycle time, outstanding invoices. See [Analytics PRD](../06-modules/analytics-prd.md).

## Journey 4: Customer self-service

1. A commercial property manager logs into the **Customer Portal**, sees all properties under management and their open/past jobs.
2. She reviews and approves a pending Estimate for a repair at one of her buildings.
3. She pays an outstanding Invoice online and downloads the paid receipt.
4. See [Customer Portal PRD](../06-modules/customer-portal-prd.md).

## Journey 5 (future phase): Parts reorder through the Marketplace

1. Curtis adds a part to a job that is out of stock in the truck inventory.
2. The system surfaces a **Marketplace** listing from a connected **Supplier** with same-day availability.
3. Denise approves the purchase order directly from the job. See [Marketplace PRD](../06-modules/marketplace-prd.md), [Suppliers PRD](../06-modules/suppliers-prd.md).

This journey is documented for domain-model completeness but is **not** in launch scope — see [Implementation Roadmap](../13-roadmap/implementation-roadmap.md).
