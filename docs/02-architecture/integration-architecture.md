# Integration Architecture

## Principles

1. All outbound third-party integrations are isolated behind a typed client in `packages/integrations/*`, never called ad hoc from route handlers or React components. See [Component Architecture](./component-architecture.md).
2. Integrations that are not on the user-facing critical path (email, SMS, accounting sync) go through the [Background Worker](./container-architecture.md#containers), not the request/response cycle.
3. Integrations on the payment critical path (capturing a card-present payment) may be called synchronously, but must be idempotent (see [ADR-018](../11-adr/ADR-018-payments.md)) since network retries are expected.
4. Inbound integration events (webhooks) are verified (signature check), persisted first, then processed — never processed purely in-memory without a durable record, so a crash mid-processing can be replayed. See [Webhooks](../05-api/webhooks.md).

## Launch-scope integrations

| Integration | Direction | Pattern | Detail |
|---|---|---|---|
| Stripe | Outbound (charge) + Inbound (webhooks: payment succeeded/failed, dispute) | Sync for capture; async webhook processing via Worker | [ADR-018](../11-adr/ADR-018-payments.md) |
| Twilio | Outbound (SMS send) + Inbound (delivery status webhooks) | Async via Worker | [Notifications PRD](../06-modules/notifications-prd.md) |
| Resend | Outbound (email send) + Inbound (bounce/complaint webhooks) | Async via Worker | [Notifications PRD](../06-modules/notifications-prd.md) |
| QuickBooks Online | Bidirectional (export invoices/payments, OAuth-connected per Organization) | Async via Worker, scheduled + on-demand sync | [Integrations PRD](../06-modules/integrations-prd.md) |
| Supabase Auth | Bidirectional (session issuance/verification) | Sync, in the request path | [ADR-006](../11-adr/ADR-006-authentication.md) |
| Supabase Storage | Bidirectional (signed upload/download URLs) | Sync, in the request path | [ADR-013](../11-adr/ADR-013-file-storage.md) |

## Future-phase integration surfaces (not built at launch)

- Supplier Marketplace partner APIs (product catalog, order placement) — [Marketplace PRD](../06-modules/marketplace-prd.md).
- Manufacturer partner APIs (warranty registration, product data) — [Manufacturers PRD](../06-modules/manufacturers-prd.md).
- Financial services partner APIs (financing origination, faster-payout rails) — [Strategic Phase 5](../13-roadmap/phase-6-financial-services.md).

These are designed for in their respective PRDs but have no client code, credentials, or route handlers at launch.

## Resilience patterns

- **Retries**: all outbound integration calls from the Worker use exponential backoff with a bounded retry count, then move to a dead-letter state visible to support/ops tooling. See [ADR-016](../11-adr/ADR-016-background-jobs.md).
- **Circuit awareness**: a third-party outage degrades gracefully — e.g., if Twilio is down, SMS sends queue and retry rather than blocking Job dispatch, which must never depend synchronously on notification delivery succeeding.
- **Webhook idempotency**: every inbound webhook is deduplicated by the provider's event ID before being processed, since providers guarantee at-least-once delivery.

## API access for third parties (inbound integration surface)

Atlas exposes its own versioned REST API (`/api/v1/`) for future third-party and partner integrations (accounting tools beyond QuickBooks, Zapier-style automation, and eventually Marketplace/Manufacturer partners). See [API Overview](../05-api/api-overview.md) and [Integrations](../05-api/integrations.md).
