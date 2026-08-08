# ADR-021: Observability Stack (Sentry + Axiom + Native Platform Monitoring)

## Status

Accepted

## Date

2026-08-08

## Context

Atlas needs to detect, diagnose, and respond to production issues quickly — errors, performance regressions, and security-relevant anomalies (see [Monitoring](../10-devops/monitoring.md)) — without building custom observability infrastructure.

## Problem

Which tools should Atlas use for error tracking, structured logging, and uptime/performance monitoring, and how much custom tooling (versus platform-native and third-party SaaS) is justified at launch scale?

## Decision

**Sentry** for error tracking (frontend + backend), **Axiom** for structured log aggregation (via Vercel log drains), and **Vercel/Supabase native monitoring** for uptime, deployment health, and database performance — no custom-built observability platform. See [Monitoring](../10-devops/monitoring.md), [Logging](../10-devops/logging.md).

## Alternatives Considered

1. **A full self-hosted observability stack (e.g., self-managed Grafana/Prometheus/Loki)** — rejected per [Architecture Principles](../02-architecture/architecture-principles.md), principle 4: significant operational overhead (running and maintaining the observability infrastructure itself) for a team at Atlas's current stage, with managed alternatives (Sentry, Axiom) providing equivalent value with far less operational burden.
2. **Datadog (all-in-one observability)** — a credible, more expensive all-in-one alternative; rejected in favor of a lighter combination (Sentry + Axiom + native platform tools) better matched to Atlas's current scale and budget, revisitable if consolidated tooling becomes clearly justified later.
3. **No dedicated error tracking, relying only on platform logs** — rejected outright. Sentry's structured error grouping, alerting, and release tracking are meaningfully more actionable than raw logs for the error-response workflow described in [Monitoring](../10-devops/monitoring.md).

## Consequences

- Errors are automatically grouped, alerted, and correlated with `request_id` (see [Logging](../10-devops/logging.md)) without custom tooling.
- Log retention and query capability (Axiom) are decoupled from Vercel's own log retention limits.
- Three tools to configure and maintain instead of one unified platform — accepted as the right trade-off for cost and operational simplicity at this stage.

## Risks

- Tool sprawl (three observability tools) could create gaps at the seams (an issue visible in one tool but not correlated with another) — mitigated by the consistent `request_id` correlation strategy across all logging/error-tracking (see [Logging](../10-devops/logging.md)).
- As Atlas scales, a consolidated platform (e.g., Datadog) may become more cost-effective than separate best-of-breed tools — a future, straightforward reconsideration, not a foundational lock-in.

## Migration / Rollback

Each tool is independently swappable — Sentry, Axiom, and native platform monitoring are not interdependent, so consolidating onto a single platform later (or swapping any one tool) doesn't require touching the others.

## Related Decisions

[Monitoring](../10-devops/monitoring.md) · [Logging](../10-devops/logging.md) · [Disaster Recovery](../10-devops/disaster-recovery.md)
