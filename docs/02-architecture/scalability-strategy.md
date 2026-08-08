# Scalability Strategy

## Target scale (see [Non-Functional Requirements](../01-product/non-functional-requirements.md))

10,000 Organizations and 250,000 Jobs/month at launch-plus-one-year, without an architecture change. This document explains how the modular monolith + single PostgreSQL database + Supabase design meets that target, and what the specific triggers are for evolving it.

## Application tier scaling

The Next.js app is stateless and horizontally scaled by Vercel automatically per request volume — no capacity planning is required at the application tier for launch scale. See [Deployment Architecture](./deployment-architecture.md).

## Database tier scaling

PostgreSQL is the most likely bottleneck at scale, and is addressed in this order, each step only taken once the prior one is demonstrably insufficient (observed via [Monitoring](../10-devops/monitoring.md)):

1. **Correct indexing and query design** (see [Indexes](../04-database/indexes.md)) — the majority of performance issues at Atlas's target scale are solvable here, not by adding infrastructure.
2. **Vertical scaling of the Supabase Postgres instance** — increasing compute/memory tier, which is a configuration change, not an architecture change.
3. **Read replicas** for reporting/analytics workloads once they measurably contend with operational (write) traffic — Analytics queries would route to a replica while Jobs/Scheduling/Financials writes stay on the primary.
4. **Table partitioning** for the highest-volume, naturally time-partitionable tables (`audit_events`, `domain_events`, and eventually `jobs` if a single Organization's history grows very large) — Postgres-native, no new infrastructure. See [ADR-004](../11-adr/ADR-004-postgresql.md).
5. **Connection pooling** via Supabase's built-in pooler (already in place at launch, not a future step) to handle serverless function connection churn.

Sharding or moving off a single logical database is explicitly **not** on this list for the target scale — a well-indexed PostgreSQL instance comfortably handles far more than 10,000 tenants of this data shape.

## Module extraction path (if ever needed)

Because module boundaries already exist (see [Component Architecture](./component-architecture.md)), if a specific module (most plausibly `jobs`/`scheduling` given its write volume, or `notifications` given its call volume to third parties) ever needs independent scaling or deployment cadence, it can be extracted into its own service:

1. The module's tables are already logically owned by that module — extraction means moving physical ownership, not redesigning the schema.
2. The module's application-layer interface, already the only way other modules call it, becomes a network interface (internal API) instead of an in-process function call.
3. This is a **documented future option**, not a current plan — no module is extracted preemptively, per [Architecture Principles](./architecture-principles.md).

## Multi-tenant scaling considerations

- RLS policy performance is monitored specifically (see [Tenant Isolation](../07-security/tenant-isolation.md)) since poorly written policies are a common source of unexpected query plans at scale — every RLS policy is reviewed for index usage, not just correctness.
- No Organization's data volume should be able to degrade another Organization's performance; this is monitored via per-Organization query timing, and addressed via partitioning/indexing before it is addressed via infrastructure isolation (e.g., a dedicated database for one very large Organization is a documented future option, not launch scope).

## Background job scaling

`pg-boss` throughput scales with Worker instance count and Postgres capacity for the queue table; see [ADR-016](../11-adr/ADR-016-background-jobs.md) for the specific triggers (sustained queue depth growth) that would justify multiple Worker instances or, eventually, a dedicated message broker.

## Explicit non-goals

Kubernetes-based autoscaling, multi-region active-active database deployment, and microservice decomposition are not scalability goals for the roadmap horizon covered by this documentation (Phases 1–7, see [Implementation Roadmap](../13-roadmap/implementation-roadmap.md)).
