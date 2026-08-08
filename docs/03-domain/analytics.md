# Analytics

## Purpose

Analytics is the read-only aggregation layer over operational data — revenue, job volume, technician utilization, outstanding invoices — that powers Owner/Admin dashboards. Analytics is explicitly derived data, never a source of truth for any business decision the system itself makes (e.g., Job state transitions never depend on an Analytics aggregate).

## Key attributes

- Backed by PostgreSQL materialized views (see [Caching Strategy](../02-architecture/caching-strategy.md)), refreshed on a schedule via the [Background Worker](../02-architecture/container-architecture.md).
- Core aggregates: revenue by period, job volume by Job Type/status, technician utilization (scheduled vs. available hours), outstanding invoice aging, Property/Asset Job-linkage coverage (see [Success Metrics](../01-product/success-metrics.md)).

## Relationships

- **Reads from** [Jobs](./jobs.md), [Invoices](./invoices.md), [Payments](./payments.md), [Scheduling](./scheduling.md) — never writes back to them.

## Business rules

1. Analytics views are always scoped to a single Organization (tenant-isolated like every other read), and further scoped by Role (a Technician sees only their own utilization, not organization-wide revenue) — see [Roles](./roles.md), Role-to-module access summary.
2. Materialized view staleness is explicitly surfaced in the UI ("as of HH:MM") rather than presented as real-time — see [Caching Strategy](../02-architecture/caching-strategy.md).
3. Analytics never becomes the authoritative record for any financial figure — a dashboard revenue number is always reconcilable back to the underlying Invoices/Payments, and any discrepancy is treated as an Analytics bug, not an acceptable approximation.

## Data requirements

Materialized views (e.g., `mv_revenue_by_period`, `mv_technician_utilization`, `mv_invoice_aging`), refreshed by a scheduled Worker job. See [Database Architecture](../04-database/database-architecture.md).

## Permission requirements

See [Roles](./roles.md), Role-to-module access summary — Owner/Admin/Accountant get organization-wide views; Dispatcher gets Team-scoped views; Technician gets self-scoped views only.

## Related documents

[Analytics PRD](../06-modules/analytics-prd.md) · [Reporting PRD](../06-modules/reporting-prd.md) · [Success Metrics](../01-product/success-metrics.md)
