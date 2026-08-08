# Architecture Principles

These principles govern every architecture and implementation decision. They operationalize [Product Principles](../00-overview/product-principles.md) at the technical level.

## 1. Modular monolith first

One deployable application (see [Container Architecture](./container-architecture.md)) with strict internal module boundaries mirroring the domain (Identity, CRM, Properties, Jobs, Scheduling, Financials, Inventory...). Modules communicate through well-defined application-layer interfaces and, for cross-module side effects, an internal event mechanism (see [Event-Driven Architecture](./event-driven-architecture.md)) — never by reaching directly into another module's database tables from application code outside that module's owner boundary. This keeps a future extraction into services possible without a rewrite. See [ADR-001](../11-adr/ADR-001-monorepo.md).

## 2. Layered separation: Presentation, Application, Domain, Infrastructure

- **Presentation** (React Server/Client Components): renders UI and captures input. Contains no business rules.
- **Application** (route handlers / server actions): orchestrates a use case — validates input (Zod), calls domain logic, calls infrastructure, returns a result.
- **Domain**: pure business logic and rules (state machines, pricing calculations, permission checks) with no framework or database dependency.
- **Infrastructure**: database access (Drizzle), external APIs (Stripe, Twilio), file storage.

Business logic never lives inside a React component. See [Component Architecture](./component-architecture.md), [Project Structure](../08-engineering/project-structure.md).

## 3. Database-enforced multi-tenancy

Row Level Security is the last line of defense for tenant isolation, always on, never bypassed by application code taking a shortcut. See [ADR-007](../11-adr/ADR-007-multi-tenancy.md), [Tenant Isolation](../07-security/tenant-isolation.md).

## 4. Use PostgreSQL before adding infrastructure

Full-text search, `LISTEN/NOTIFY`, materialized views, partitioning, and `pg-boss`-style queue tables are used before introducing Elasticsearch, Kafka, or Redis. New infrastructure requires a documented ADR showing that PostgreSQL's capabilities were evaluated and found insufficient — not merely less trendy. See [ADR-014](../11-adr/ADR-014-search.md), [ADR-015](../11-adr/ADR-015-caching.md), [ADR-016](../11-adr/ADR-016-background-jobs.md).

## 5. API-first, even for the first-party web app

The Next.js frontend consumes the same versioned REST API (`/api/v1/`) that any future third-party integration would use — there is no private, undocumented backend channel that only the first-party UI can call. See [ADR-010](../11-adr/ADR-010-api-first.md).

## 6. Events record history; they do not replace the relational model

Where cross-module reactions are needed (e.g., "Job completed" triggers invoice generation and a notification), Atlas uses an internal, Postgres-transaction-scoped event mechanism, not a message broker, and always alongside — never instead of — the durable relational record. Atlas does not adopt full event sourcing as its persistence model. See [ADR-011](../11-adr/ADR-011-event-history.md), [Event-Driven Architecture](./event-driven-architecture.md).

## 7. Every architecture decision with lasting consequence is an ADR

Decisions that are expensive to reverse (data model shape, core technology choice, tenancy model) are recorded in [`11-adr/`](../11-adr/) before implementation. Trivial implementation details are not ADRs — see [ADR template guidance](../11-adr/ADR-001-monorepo.md) for the bar.

## 8. Design for extraction, don't perform extraction

Module boundaries, database ownership per module, and internal APIs are designed so a module (e.g., Jobs, Payments) *could* be extracted into a separate service under real scale pressure — but no module is extracted preemptively. See [Scalability Strategy](./scalability-strategy.md).

## 9. Observability is not optional

Every request is traceable end-to-end; every background job run is logged with outcome; every payment-affecting operation is auditable. See [Monitoring](../10-devops/monitoring.md), [Logging](../10-devops/logging.md).

## 10. Configuration over forking for trade differences

Trade-specific behavior (Job Types, Asset Types, checklists, forms, pricing) is data, not code. No `if (trade === 'hvac')` branching accumulates in core domain logic — trade differences are expressed through the configuration entities defined in [Domain Overview](../03-domain/domain-overview.md). See [ADR-009](../11-adr/ADR-009-domain-modules.md).
