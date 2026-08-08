# ADR-018: Stripe for Payment Processing

## Status

Accepted

## Date

2026-08-08

## Context

Atlas must accept online and card-present payments (see [Payments](../03-domain/payments.md)) while minimizing PCI compliance scope — Atlas should never directly handle raw card data, per [Product Principles](../00-overview/product-principles.md) and [Data Protection](../07-security/data-protection.md).

## Problem

Which payment processor should Atlas integrate with, and how should Atlas's data model avoid ever storing card data directly?

## Decision

**Stripe** (including Stripe Terminal for card-present capture) is Atlas's payment processor. All card data is tokenized client-side via Stripe's SDKs; Atlas stores only the resulting `processor_reference_id` and non-sensitive metadata. Every capture request requires an `Idempotency-Key`. See [Payments](../03-domain/payments.md), [Payments PRD](../06-modules/payments-prd.md).

## Alternatives Considered

1. **Square** — a credible alternative, especially strong for card-present/field-service use cases; Stripe was selected for its more comprehensive API/webhook ecosystem and stronger fit for the future Marketplace/Financial Services pillars (Stripe Connect for multi-party payouts — see [Roadmap Phase 6](../13-roadmap/phase-6-financial-services.md)), which Atlas's roadmap explicitly anticipates.
2. **Building a direct bank/card-network integration** — rejected outright. Would place Atlas in full PCI Level 1 scope and require payment-network relationships far beyond what a platform of Atlas's stage should own.
3. **Multiple payment processors from launch (processor abstraction layer)** — rejected as premature; a single, well-integrated processor is simpler to build, test, and reason about, with the payments code isolated enough (see [Integration Architecture](../02-architecture/integration-architecture.md)) that adding a second processor later is additive, not a rewrite.

## Consequences

- PCI compliance scope is minimized to SAQ-A-equivalent levels (Atlas never touches raw card data) — see [Data Protection](../07-security/data-protection.md).
- Payment capture on the critical path (card-present, customer waiting) is synchronous; reconciliation and refund processing rely on webhook-driven asynchronous confirmation (see [Webhooks](../05-api/webhooks.md)) as the authoritative source of truth for Payment completion, not the client's immediate response.
- Idempotency keys are mandatory on every capture request, preventing double-charges from network retries — see [Acceptance Criteria](../01-product/acceptance-criteria.md).

## Risks

- Stripe outages or API changes directly affect Atlas's ability to collect payment — mitigated by webhook-based reconciliation ensuring no payment state is lost even if the synchronous request path is disrupted mid-flight, and by monitoring Stripe's status independently (see [Monitoring](../10-devops/monitoring.md)).
- Vendor dependency for a business-critical function — accepted given the alternative (building payment infrastructure in-house) is categorically worse from both a risk and a focus perspective.

## Migration / Rollback

Payment processing is isolated behind `packages/integrations/stripe` (see [Project Structure](../08-engineering/project-structure.md)); the `payments` table's `processor`/`processor_reference_id` columns are already designed to support a future second processor without a schema change — see [Payments](../03-domain/payments.md).

## Related Decisions

[Payments](../03-domain/payments.md) · [Payments PRD](../06-modules/payments-prd.md) · [Data Protection](../07-security/data-protection.md) · [Roadmap Phase 6](../13-roadmap/phase-6-financial-services.md)
