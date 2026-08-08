# Component Architecture

## Purpose

Shows the internal module structure inside the Next.js application (the "Atlas" container in [Container Architecture](./container-architecture.md)). This is what "modular monolith" means concretely.

## Module map

Each domain module owns its own database tables, its own domain logic, and exposes a typed application-layer interface that other modules call through — never by importing another module's database queries directly.

```mermaid
flowchart TB
    subgraph Presentation["Presentation Layer (apps/web/app)"]
        UI["React Server/Client Components"]
        Routes["Route Handlers (/api/v1/*)"]
    end

    subgraph Modules["Domain Modules (packages/modules/*)"]
        Identity["identity\n(users, memberships, roles, permissions)"]
        Org["organization\n(organizations, teams)"]
        CRM["crm\n(customers, contacts)"]
        Properties["properties\n(properties, buildings, rooms, assets)"]
        Jobs["jobs\n(jobs, tasks, scheduling, dispatch)"]
        Financials["financials\n(estimates, invoices, payments)"]
        Inventory["inventory\n(inventory items, suppliers)"]
        Documents["documents"]
        Notifications["notifications"]
        Analytics["analytics"]
    end

    subgraph Infra["Infrastructure Layer (packages/db, packages/integrations)"]
        DB["Drizzle schema + query layer"]
        ExtAPIs["External API clients\n(Stripe, Twilio, Resend, QBO)"]
    end

    UI --> Routes
    Routes --> Identity & Org & CRM & Properties & Jobs & Financials & Inventory & Documents & Notifications & Analytics
    Jobs --> CRM
    Jobs --> Properties
    Jobs --> Inventory
    Financials --> Jobs
    Financials --> CRM
    Dispatch2["Jobs module"] -.event: job.completed.-> Financials
    Dispatch2 -.event: job.dispatched.-> Notifications
    Financials -.event: invoice.paid.-> Notifications
    Identity & Org & CRM & Properties & Jobs & Financials & Inventory & Documents & Notifications & Analytics --> DB
    Financials --> ExtAPIs
    Notifications --> ExtAPIs
```

## Module responsibilities

| Module | Owns | Depends on (application-layer calls) | PRDs |
|---|---|---|---|
| `identity` | users, memberships, roles, permissions | — (foundational) | [Identity PRD](../06-modules/identity-prd.md) |
| `organization` | organizations, teams, settings | `identity` | [Organization PRD](../06-modules/organization-prd.md) |
| `crm` | customers, contacts | `organization` | [CRM PRD](../06-modules/crm-prd.md), [Customers PRD](../06-modules/customers-prd.md) |
| `properties` | properties, buildings, rooms, assets | `organization`, `crm` | [Properties PRD](../06-modules/properties-prd.md), [Assets PRD](../06-modules/assets-prd.md) |
| `jobs` | jobs, tasks, scheduling, dispatch | `crm`, `properties`, `identity` | [Jobs PRD](../06-modules/jobs-prd.md), [Scheduling PRD](../06-modules/scheduling-prd.md), [Dispatch PRD](../06-modules/dispatch-prd.md) |
| `financials` | estimates, invoices, payments | `jobs`, `crm` | [Estimates PRD](../06-modules/estimates-prd.md), [Invoicing PRD](../06-modules/invoicing-prd.md), [Payments PRD](../06-modules/payments-prd.md) |
| `inventory` | inventory items, stock levels, suppliers | `organization` | [Inventory PRD](../06-modules/inventory-prd.md), [Suppliers PRD](../06-modules/suppliers-prd.md) |
| `documents` | documents, attachments | `jobs`, `properties` | [Documents PRD](../06-modules/documents-prd.md) |
| `notifications` | notification records, preferences | all modules (as event consumer) | [Notifications PRD](../06-modules/notifications-prd.md) |
| `analytics` | read-only aggregation views | all modules (read-only) | [Analytics PRD](../06-modules/analytics-prd.md) |

## Rules governing module boundaries

1. A module's database tables are only ever queried directly by that module's own infrastructure code. Other modules call its application-layer functions/interfaces.
2. Cross-module reactions (e.g., completing a Job should generate an Invoice and a Notification) are expressed as domain events, not direct synchronous calls chained across modules — see [Event-Driven Architecture](./event-driven-architecture.md).
3. A module may depend "downward" only, per the dependency arrows above. Circular module dependencies are not permitted — e.g., `crm` must never call into `jobs`.
4. Shared primitives (money type, date/time handling, ID generation) live in `packages/shared`, not duplicated per module.

## Mapping to source layout

See [Project Structure](../08-engineering/project-structure.md) for the literal directory layout implementing this component diagram.
