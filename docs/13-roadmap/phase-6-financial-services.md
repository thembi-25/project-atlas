# Phase 6: Financial Services

> **Technical Implementation Phase 6 of 7 — Financial Services Build.** Implements: **Strategic Product Phase 5 — Financial Services.** See [ROADMAP-DECISION.md](./ROADMAP-DECISION.md). Does not depend on Property Intelligence, Supplier Marketplace, or Manufacturer Integrations — see Section D of that document.

## Goal

Offer financial products — customer financing for larger repairs/installs, faster payouts for contractors — built on the trustworthy Job and payment history Atlas has accumulated by this point. See [Vision](../00-overview/vision.md), pillar 5.

## Scope

- Customer financing option presentation at Estimate approval time (partner-provided financing, not Atlas originating loans itself) — see [Estimates PRD](../06-modules/estimates-prd.md), Future Extensions.
- Faster payouts to Organizations via Stripe Connect or a similar rails partner, building on the existing [Payments](../03-domain/payments.md) infrastructure — see [ADR-018](../11-adr/ADR-018-payments.md).
- Underwriting-relevant reporting (job volume, payment reliability history) made available to financial partners with the Organization's explicit consent — never shared without opt-in, consistent with [Product Principles](../00-overview/product-principles.md), principle 9.

## Dependencies

Requires Technical Implementation Phase 2 ([Phase 2: Core Operations](./phase-2-core-operations.md)) complete with sufficient job volume and payment history per Organization to underwrite responsibly, plus a live financing/payout partner — this phase is explicitly gated on data maturity and partnership readiness, not just calendar time, per [Business Objectives](../00-overview/business-objectives.md) and [ROADMAP-DECISION.md](./ROADMAP-DECISION.md), Section D.

## Exit criteria

- At least one financing partner integration live at Estimate approval.
- Faster-payout option available and adopted by a meaningful share of active Organizations.
- Underwriting data-sharing consent flow reviewed for compliance and genuinely opt-in, not a buried default.

## Explicitly out of scope for this phase

Atlas originating or holding loans directly — Atlas partners with licensed financial institutions rather than becoming one itself.

## Related documents

[ROADMAP-DECISION.md](./ROADMAP-DECISION.md) · [Payments](../03-domain/payments.md) · [ADR-018: Payments](../11-adr/ADR-018-payments.md) · [Business Objectives](../00-overview/business-objectives.md)
