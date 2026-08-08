# Project Atlas — Documentation

Project Atlas is a vertical Industry Cloud Platform for field-service trades, launching with plumbing, HVAC, and electrical service businesses. This directory is the authoritative source of truth for product, architecture, domain, database, API, security, engineering, and delivery decisions. It exists to be read by human engineers and by Claude Code before any implementation work begins.

## How to use this documentation

- **Before implementing a feature**, read the relevant PRD in `06-modules/`, the relevant domain model in `03-domain/`, and any ADRs in `11-adr/` that govern the area.
- **Before touching the database**, read `04-database/` and the specific domain entity doc — never invent a table that isn't documented.
- **Before touching the API**, read `05-api/` for conventions before adding or changing an endpoint.
- **Claude Code specifically** should start at [`12-claude/claude-code-guide.md`](./12-claude/claude-code-guide.md).

## Documentation map

| Section | Purpose |
|---|---|
| [`00-overview/`](./00-overview/) | Vision, mission, principles, market, personas, roadmap at a glance |
| [`01-product/`](./01-product/) | Product strategy, scope, requirements, pricing, success metrics |
| [`02-architecture/`](./02-architecture/) | System architecture, tech stack, deployment, integration, scaling |
| [`03-domain/`](./03-domain/) | The business domain model — entities, relationships, business rules |
| [`04-database/`](./04-database/) | PostgreSQL schema design, conventions, multi-tenancy, migrations |
| [`05-api/`](./05-api/) | REST API conventions, auth, pagination, errors, versioning |
| [`06-modules/`](./06-modules/) | Per-module Product Requirements Documents (PRDs) |
| [`07-security/`](./07-security/) | Security architecture, threat model, tenant isolation |
| [`08-engineering/`](./08-engineering/) | Coding standards, project structure, git workflow |
| [`09-testing/`](./09-testing/) | Testing strategy across all layers |
| [`10-devops/`](./10-devops/) | Environments, CI/CD, deployment, observability, DR |
| [`11-adr/`](./11-adr/) | Architecture Decision Records |
| [`12-claude/`](./12-claude/) | Instructions specifically for Claude Code |
| [`13-roadmap/`](./13-roadmap/) | Phased implementation roadmap and sprint plans |

## Core facts (read this before anything else)

- **Product**: a multi-tenant SaaS platform for field-service businesses (plumbing, HVAC, electrical at launch), organized around Organizations, Customers, Properties, Assets, and Jobs. See [Domain Overview](./03-domain/domain-overview.md).
- **Not an AI product**: AI is a future supporting capability, not the differentiator. See [Product Principles](./00-overview/product-principles.md) and [ADR-020](./11-adr/ADR-020-ai-architecture.md).
- **Trade-aware, not trade-specific**: one architecture serves every trade through configuration (trade types, asset types, job types, checklists, forms, pricing), not through forked codebases. See [ADR-009](./11-adr/ADR-009-domain-modules.md).
- **Stack**: Next.js (App Router) + TypeScript + React + Tailwind CSS + shadcn/ui on the frontend; a modular monolith on Next.js Route Handlers for the backend; PostgreSQL via Supabase for data, auth, storage. See [Technology Stack](./02-architecture/technology-stack.md).
- **Multi-tenancy**: Organization is the tenant boundary, enforced at the database layer with PostgreSQL Row Level Security, never solely in application code. See [Multi-Tenancy](./04-database/multi-tenancy.md) and [Tenant Isolation](./07-security/tenant-isolation.md).
- **API**: REST, versioned at `/api/v1/`, JSON, cursor pagination. See [API Overview](./05-api/api-overview.md).
- **No overengineering**: no Kubernetes, no microservices, no Kafka, no Elasticsearch, no GraphQL, no service mesh at launch. PostgreSQL capabilities are used before new infrastructure is introduced. See [Architecture Principles](./02-architecture/architecture-principles.md).

## Document conventions

- Every PRD in `06-modules/` follows a fixed 20-section template (Purpose through Future Extensions).
- Every ADR in `11-adr/` follows the standard ADR template (Status, Context, Decision, Alternatives, Consequences, Risks, Migration/Rollback, Related Decisions).
- Cross-references use relative Markdown links, e.g. a document inside `06-modules/` linking to Properties would use `[Property Domain](../03-domain/properties.md)`.
- Terminology is centralized in [`00-overview/terminology.md`](./00-overview/terminology.md) — use those terms consistently; do not introduce synonyms.
- Diagrams use [Mermaid](https://mermaid.js.org/) and are included only where they communicate real architecture, not decoration.

## Status

This documentation set was authored before any production implementation. See [`DOCUMENTATION-CONSISTENCY-REPORT.md`](./DOCUMENTATION-CONSISTENCY-REPORT.md) for the consistency audit, open questions, and the recommended next implementation step.
