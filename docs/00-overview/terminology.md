# Terminology

This glossary is the single source of truth for terms used across the documentation. Every document should use these terms exactly as defined here — do not introduce synonyms (e.g., do not use "account" when "Organization" is meant, do not use "site" when "Property" is meant).

| Term | Definition |
|---|---|
| **Organization** | The tenant boundary. A single field-service business (e.g., "Riverside Plumbing LLC") that subscribes to Atlas. All tenant-owned data belongs to exactly one Organization. See [Organization](../03-domain/organization.md). |
| **User** | An individual with login credentials who belongs to one or more Organizations via a Membership. See [Users](../03-domain/users.md). |
| **Membership** | The join entity between a User and an Organization, carrying the User's Role(s) within that Organization. See [Roles](../03-domain/roles.md). |
| **Role** | A named set of Permissions assigned to a Membership (e.g., Owner, Admin, Dispatcher, Technician, Accountant, Read Only). See [Roles](../03-domain/roles.md), [Permissions](../03-domain/permissions.md). |
| **Technician** | A User whose Membership Role includes field job execution. Not a separate identity system — see [Technicians](../03-domain/technicians.md). |
| **Team** | An optional grouping of Users within an Organization (e.g., "HVAC Crew A") used for scheduling and reporting. |
| **Customer** | The party (residential or commercial) that an Organization performs work for. A Customer is owned by exactly one Organization. See [Customers](../03-domain/customers.md). |
| **Contact** | An individual person associated with a Customer (e.g., a property manager, a homeowner's spouse). See [Contacts](../03-domain/contacts.md). |
| **Property** | A physical location where work is performed — an address with structure. Properties are first-class, persistent entities independent of any single Job. See [Properties](../03-domain/properties.md). |
| **Building** | A physical structure on a Property. A Property may have one or more Buildings (e.g., a commercial Property with multiple units). See [Buildings](../03-domain/buildings.md). |
| **Room** | A discrete space within a Building (e.g., "Mechanical Room", "Kitchen") used to locate Assets precisely. See [Rooms](../03-domain/rooms.md). |
| **Asset** | A piece of installed equipment tracked over its lifecycle (e.g., a water heater, an HVAC condenser, an electrical panel), belonging to a Property (and optionally a Building/Room). See [Assets](../03-domain/assets.md). |
| **Trade** | A discipline of field service (Plumbing, HVAC, Electrical, and future trades), represented as configuration data (`trade_types`), not as separate code. |
| **Job** | A discrete unit of work performed for a Customer, typically at a Property, optionally against specific Assets. See [Jobs](../03-domain/jobs.md). |
| **Task** | A step or checklist item within a Job. See [Tasks](../03-domain/tasks.md). |
| **Dispatch** | The act of assigning and communicating a scheduled Job to a Technician for execution. See [Dispatch](../03-domain/dispatch.md). |
| **Estimate** | A priced proposal for work, presented to a Customer before a Job is authorized or before additional work is approved. See [Estimates](../03-domain/estimates.md). |
| **Invoice** | A finalized, immutable bill for completed work, generated from a Job (and typically from an accepted Estimate). See [Invoices](../03-domain/invoices.md). |
| **Payment** | A recorded transfer of funds from a Customer against one or more Invoices. See [Payments](../03-domain/payments.md). |
| **Inventory Item** | A trackable part or material an Organization stocks and consumes on Jobs. See [Inventory](../03-domain/inventory.md). |
| **Supplier** | A vendor an Organization purchases parts/materials from. See [Suppliers](../03-domain/suppliers.md). |
| **Manufacturer** | The maker of equipment installed as Assets, relevant for warranty and compliance data. See [Manufacturers](../03-domain/manufacturers.md). |
| **Warranty** | A time-bound coverage record tied to an Asset and, where applicable, a Manufacturer. See [Warranties](../03-domain/warranties.md). |
| **Marketplace** | The future commerce layer connecting Organizations to Suppliers for parts ordering. See [Marketplace](../03-domain/marketplace.md). |
| **Audit Event** | An immutable record of a state-changing action taken on tenant data. See [Audit Events](../03-domain/audit-events.md). |
| **Tenant Isolation** | The guarantee that one Organization's data is never visible or writable by another Organization, enforced via PostgreSQL Row Level Security. See [Tenant Isolation](../07-security/tenant-isolation.md). |
| **Modular Monolith** | The application architecture pattern used by Atlas: one deployable Next.js application with strict internal module boundaries, as opposed to microservices. See [ADR-001](../11-adr/ADR-001-monorepo.md), [Architecture Overview](../02-architecture/architecture-overview.md). |

## Naming rules for new terms

1. Check this glossary before introducing a new business term in any document.
2. If a new term is genuinely needed, add it here in the same pull request that introduces it.
3. Database table/column names must derive directly from these terms — see [Database Naming Conventions](../04-database/naming-conventions.md).
