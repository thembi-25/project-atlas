# Webhooks

## Two directions

1. **Inbound webhooks** Atlas receives from third parties (Stripe, Twilio, Resend, QuickBooks Online) — see [Integration Architecture](../02-architecture/integration-architecture.md).
2. **Outbound webhooks** Atlas will send to future third-party/partner integrations — documented here for the contract shape, not built at launch (no Organization-facing webhook subscription UI exists yet — see [Integrations PRD](../06-modules/integrations-prd.md)).

## Inbound webhook handling pattern

1. Verify the provider's signature (e.g., Stripe's `Stripe-Signature` header) before parsing the body at all — an unverified webhook is never trusted.
2. Persist the raw verified event (with the provider's event ID) to a durable table **before** any processing logic runs, so a crash mid-processing can be safely replayed from the persisted record rather than lost or double-side-effected from a redelivered request.
3. Deduplicate by provider event ID — providers guarantee at-least-once delivery, so Atlas must be idempotent on receipt.
4. Hand off actual processing to the [Background Worker](../02-architecture/container-architecture.md) rather than doing it inline in the webhook route handler, so a slow downstream processing step never risks the provider's delivery timeout (which could trigger unnecessary redelivery).
5. Respond `200` promptly once the event is durably persisted, regardless of whether processing has completed yet.

## Example: Stripe payment webhook (inbound)

```http
POST /api/v1/webhooks/stripe
Stripe-Signature: t=1691500000,v1=...
Content-Type: application/json

{ "id": "evt_1Nx...", "type": "payment_intent.succeeded", "data": { "...": "..." } }
```
Atlas verifies the signature, persists the event, enqueues Worker processing (updating the corresponding [Payment](../03-domain/payments.md) record), and responds `200` with an empty body.

## Outbound webhooks (future, documented for domain completeness)

- Organization-configurable subscription to specific [Domain Events](../02-architecture/event-driven-architecture.md) (`job.completed`, `invoice.paid`).
- Delivered with a signed payload (HMAC using an Organization-specific signing secret) so the receiving system can verify authenticity.
- Retried with exponential backoff on non-2xx response, with a dead-letter/disable-after-N-failures policy to avoid indefinitely hammering a broken receiving endpoint.
- Not built at launch — see [Integrations PRD](../06-modules/integrations-prd.md), Future Extensions.

## Related documents

[Integration Architecture](../02-architecture/integration-architecture.md) · [Event-Driven Architecture](../02-architecture/event-driven-architecture.md) · [Integrations](./integrations.md) · [ADR-016: Background Jobs](../11-adr/ADR-016-background-jobs.md)
