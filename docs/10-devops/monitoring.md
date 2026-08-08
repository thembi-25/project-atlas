# Monitoring

## What is monitored

| Signal | Tool | Alert threshold (directional) |
|---|---|---|
| Application errors | Sentry (frontend + backend) | Spike in error rate relative to trailing baseline; any new error type on a payment/auth code path alerts immediately regardless of volume |
| API latency (p50/p95/p99) | Vercel Analytics + custom request timing | p95 exceeding [Non-Functional Requirements](../01-product/non-functional-requirements.md) targets sustained over 5 minutes |
| Database performance | Supabase built-in monitoring + `pg_stat_statements` review | Slow-query threshold breach, connection pool saturation |
| Background job queue health | `pg-boss` queue depth/age metrics | Queue depth growing sustained over time (not transient burst) — see [ADR-016](../11-adr/ADR-016-background-jobs.md) |
| Uptime | Vercel + Supabase native monitoring | Any downtime against the 99.9% target in [Non-Functional Requirements](../01-product/non-functional-requirements.md) |
| Third-party integration health | Custom health checks + webhook delivery failure rate | Sustained failure rate to Stripe/Twilio/Resend/QuickBooks |
| Security-relevant signals | Failed login rate, rate-limit trigger frequency | Sustained spike suggesting credential stuffing or abuse — see [Threat Model](../07-security/threat-model.md) |

## Per-Organization performance isolation monitoring

Query timing is tracked with `organization_id` as a dimension specifically to detect one Organization's data volume degrading their own (or, in a shared-resource-contention scenario, others') performance before it becomes a widespread incident — see [Scalability Strategy](../02-architecture/scalability-strategy.md).

## Alerting and on-call

Alerts route to the on-call engineer via the team's paging tool (e.g., PagerDuty/Opsgenee — specific tool selection is an implementation detail outside this document's scope) with severity-tiered response expectations: a Production outage or payment-processing failure pages immediately; a non-critical degraded-performance signal creates a ticket for next-business-day triage.

## Dashboards

A single operational dashboard surfaces the signals above at a glance for daily engineering review, separate from the [Analytics](../03-domain/analytics.md) module's *business-facing* dashboards (revenue, utilization) — operational monitoring and business analytics are different audiences and different tools, not conflated.

## Synthetic monitoring

A scheduled synthetic check exercises the highest-criticality golden path (login → view Jobs → basic read) against Production every few minutes, independent of real user traffic, so an outage is detected even during low-traffic periods before a real user reports it.

## Related documents

[Logging](./logging.md) · [Scalability Strategy](../02-architecture/scalability-strategy.md) · [Disaster Recovery](./disaster-recovery.md) · [Threat Model](../07-security/threat-model.md)
