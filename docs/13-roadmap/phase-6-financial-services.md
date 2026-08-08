# Phase 6: Financial Services

## Goal

Offer financial products — customer financing for larger repairs/installs, faster payouts for contractors — built on the trustworthy Job and payment history Atlas has accumulated by this point. See [Vision](../00-overview/vision.md), pillar 5.

## Scope

- Customer financing option presentation at Estimate approval time (partner-provided financing, not Atlas originating loans itself) — see [Estimates PRD](../06-modules/estimates-prd.md), Future Extensions.
- Faster payouts to Organizations via Stripe Connect or a similar rails partner, building on the existing [Payments](../03-domain/payments.md) infrastructure — see [ADR-018](../11-adr/ADR-018-payments.md).
- Underwriting-relevant reporting (job volume, payment reliability history) made available to financial partners with the Organization's explicit consent — never shared without opt-in, consistent with [Product Principles](../00-overview/product-principles.md), principle 9.

## Dependencies

Requires [Phase 2: Core Operations](./phase-2-core-operations.md) complete with sufficient job volume and payment history per Organization to underwrite responsibly — this phase is explicitly gated on data maturity, not just calendar time, per [Business Objectives](../00-overview/business-objectives.md).

## Exit criteria

- At least one financing partner integration live at Estimate approval.
- Faster-payout option available and adopted by a meaningful share of active Organizations.
- Underwriting data-sharing consent flow reviewed for compliance and genuinely opt-in, not a buried default.

## Explicitly out of scope for this phase

Atlas originating or holding loans directly — Atlas partners with licensed financial institutions rather than becoming one itself.

## Related documents

[Payments](../03-domain/payments.md) · [ADR-018: Payments](../11-adr/ADR-018-payments.md) · [Business Objectives](../00-overview/business-objectives.md)
