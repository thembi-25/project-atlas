# ADR-017: Notification Delivery via Resend and Twilio

## Status

Accepted

## Date

2026-08-08

## Context

Atlas needs reliable email and SMS delivery for scheduling, dispatch, and financial notifications (see [Notifications PRD](../06-modules/notifications-prd.md)) without building deliverability infrastructure (SPF/DKIM reputation management, SMS carrier relationships) in-house.

## Problem

Should Atlas build its own email/SMS sending infrastructure, or integrate with dedicated transactional messaging providers — and which ones?

## Decision

**Resend** for transactional email, **Twilio** for SMS, both called exclusively from the [Background Worker](../02-architecture/container-architecture.md), never inline in the request path. See [Integration Architecture](../02-architecture/integration-architecture.md).

## Alternatives Considered

1. **Building email/SMS sending in-house (raw SMTP, direct carrier SMS relationships)** — rejected outright. Email deliverability (avoiding spam classification) and SMS carrier compliance are specialized, ongoing operational concerns with no product-differentiation value for Atlas to own.
2. **SendGrid (email) instead of Resend** — a credible alternative; Resend was selected for its more modern developer experience and API ergonomics, with no functional gap that would favor SendGrid for Atlas's use case. This is a low-stakes, easily-revisited choice, not a foundational one.
3. **A single combined provider for both email and SMS** — evaluated; no single provider available at decision time matched both Resend's email developer experience and Twilio's SMS reliability/carrier reach well enough to justify consolidating onto a weaker option in either channel.

## Consequences

- Two vendor relationships and API integrations to maintain (see [Integration Architecture](../02-architecture/integration-architecture.md)), isolated behind typed clients in `packages/integrations/*`.
- Delivery status (bounces, failures) is tracked via provider webhooks, feeding the delivery-failure visibility described in [Notifications PRD](../06-modules/notifications-prd.md).
- Notification sending never blocks the triggering business operation (see [Event-Driven Architecture](../02-architecture/event-driven-architecture.md)) — a Resend/Twilio outage degrades notification delivery, never Job/Invoice/Payment functionality.

## Risks

- Provider outages affect notification delivery — mitigated by retry-with-backoff and a documented dead-letter/failure-visibility path (see [Integration Architecture](../02-architecture/integration-architecture.md)) rather than silent message loss.
- SMS costs scale with Organization/Customer volume — monitored as a straightforward operational cost, not an architectural risk.

## Migration / Rollback

Both providers are integrated behind a typed client interface in `packages/integrations/*` (see [Project Structure](../08-engineering/project-structure.md)) — swapping either provider later requires reimplementing that one client, not touching the modules that trigger notifications.

## Related Decisions

[Notifications PRD](../06-modules/notifications-prd.md) · [Integration Architecture](../02-architecture/integration-architecture.md) · [ADR-016: Background Jobs](./ADR-016-background-jobs.md)
