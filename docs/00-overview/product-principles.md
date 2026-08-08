# Product Principles

These principles are binding constraints on product and architecture decisions. When a proposed feature or design conflicts with one of these, the principle wins unless an ADR explicitly documents an exception.

## 1. The property and asset are permanent; the job is transient

A job is a single episode. A property and the assets inside it persist across hundreds of jobs and years. Every design decision defaults to preserving property/asset history rather than treating jobs as isolated, disposable records. See [Properties](../03-domain/properties.md), [Assets](../03-domain/assets.md), [ADR-011: Event History](../11-adr/ADR-011-event-history.md).

## 2. One platform, many trades — configuration over forked code

Plumbing, HVAC, and electrical (and future trades) are never implemented as separate codebases, separate schemas, or separate architectures. Trade-specific behavior is expressed through configuration: trade types, asset types, job types, service categories, checklists, forms, and pricing structures. See [ADR-009](../11-adr/ADR-009-domain-modules.md).

## 3. Tenant isolation is a database guarantee, not an application promise

Every tenant-owned record is protected by PostgreSQL Row Level Security. The application layer must never be the last line of defense for multi-tenant data isolation. See [Multi-Tenancy](../04-database/multi-tenancy.md), [Tenant Isolation](../07-security/tenant-isolation.md).

## 4. AI is a supporting capability, not the product

Project Atlas is an operations and data platform. Where AI assists — e.g., suggesting a diagnosis from job notes, drafting an estimate line — it is an assistive layer on top of structured, human-verifiable data, never a black box that takes action a human didn't request. AI must never be positioned as replacing the operational judgment of the business owner, dispatcher, or technician. See [ADR-020: AI Architecture](../11-adr/ADR-020-ai-architecture.md), [AI Platform PRD](../06-modules/ai-platform-prd.md).

## 5. Start correct and simple; scale when the data demands it

We do not introduce microservices, Kafka, Elasticsearch, GraphQL, or a service mesh in anticipation of scale we don't have yet. We use PostgreSQL's own capabilities (full-text search, `LISTEN/NOTIFY`, partitioning, materialized views) before reaching for new infrastructure, and we design module boundaries so extraction into services is possible later without a rewrite. See [Architecture Principles](../02-architecture/architecture-principles.md).

## 6. Every write is attributable and auditable

Who did what, when, and from where is recoverable for every state-changing action on tenant data. This is a compliance requirement (licensing, insurance, warranty disputes) as much as a security one. See [Audit Events](../03-domain/audit-events.md), [Audit Logging](../04-database/audit-logging.md).

## 7. Money movements are never inferred, only recorded

Estimates, invoices, and payments are modeled as append-only, state-machine-governed records. We never recompute a historical invoice total from "current" line items; a finalized invoice is immutable and corrections happen through documented reversal/adjustment flows. See [Invoices](../03-domain/invoices.md), [Payments](../03-domain/payments.md).

## 8. The technician's context comes before the office's convenience

Design trade-offs default to what a technician standing at a property, often with poor signal, needs (offline-tolerant job detail, asset history, checklists) over what is merely faster for office staff to configure. See [Mobile PRD](../06-modules/mobile-prd.md).

## 9. Never let the platform become a black box to the business owner

The owner can always see, export, and reconcile their own data. No feature may lock a business's own operational data behind a proprietary format it cannot export. See [API Overview](../05-api/api-overview.md) for the same data access model available to owners via the customer-facing product.

## 10. Documentation precedes implementation

No module is implemented before its PRD, domain model, and any governing ADRs exist and are internally consistent. See [Claude Code Guide](../12-claude/claude-code-guide.md).
