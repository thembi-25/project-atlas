# Success Metrics

## North star metric

**Weekly Jobs Completed per Active Organization** — the clearest signal that an Organization has fully replaced its prior tools with Atlas, since it requires scheduling, dispatch, execution, and (typically) invoicing to all have happened inside the platform.

## Activation metrics (first 30 days of an Organization)

- % of new Organizations that complete setup (invite ≥1 technician, create ≥1 Customer, create ≥1 Property) within 7 days.
- % of new Organizations that complete a full job lifecycle (scheduled → dispatched → completed → invoiced → paid) within 14 days.
- Time from signup to first completed Job.

## Core Operations health metrics

- **Job cycle time**: median time from Job creation to Job completion, segmented by Job Type.
- **Invoice-to-payment time**: median time from Invoice generation to full payment.
- **Estimate approval rate and time-to-approval**.
- **Dispatch accuracy**: % of Jobs completed within their scheduled window without reschedule.
- **Technician utilization**: scheduled hours vs. available hours per Technician per week.

## Property Intelligence metrics (Strategic Phase 2+, but instrumented from launch)

- % of Jobs linked to a tracked Property (target: near 100% — an unlinked Job is a data-quality failure, not an acceptable pattern).
- % of Jobs linked to a specific Asset where applicable.
- Average number of historical Jobs visible to a Technician at the point of dispatch for a returning Property.

These are tracked from launch (Strategic Phase 1) onward specifically because Strategic Phase 2 features cannot be evaluated later without this baseline existing — see [Product Strategy](./product-strategy.md).

## Retention & growth metrics

- Gross and net revenue retention per Organization cohort, monthly.
- Seat expansion rate (Organizations adding Technicians over time) as a proxy for trust in the platform for day-to-day operations.
- Logo churn rate, segmented by Organization size and trade.

## Data integrity / trust metrics

- Number of tenant-isolation violations detected (target: zero, monitored continuously — see [Tenant Isolation](../07-security/tenant-isolation.md)).
- % of financial records (Invoices/Payments) with a complete, unbroken Audit Event trail.
- Support tickets classified as "data discrepancy" (invoice totals, payment mismatches) per 1,000 Jobs.

## Anti-metrics (explicitly not optimized for)

- Raw feature count or "AI features shipped" — per [Product Principles](../00-overview/product-principles.md), AI is not a differentiator and is not tracked as a success metric in its own right.
- Time-in-app for office staff — more time spent reconciling data manually is a failure signal, not an engagement win.

## Traceability

Success metrics map back to [Business Objectives](../00-overview/business-objectives.md) and are the evaluation criteria referenced when deciding whether a Roadmap Phase (see [`13-roadmap/`](../13-roadmap/)) is ready to progress to the next.
