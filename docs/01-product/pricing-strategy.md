# Pricing Strategy

## Model

Per-seat SaaS subscription, billed monthly or annually, tiered by feature access and seat count. "Seat" is defined as a Membership with a Role other than Read Only or Customer Portal (i.e., Owner, Admin, Dispatcher, Technician, Accountant Roles consume a seat; unlimited Customer Portal Contacts do not). See [Roles](../03-domain/roles.md).

## Tier structure (directional — final pricing is a business decision, not an engineering one)

| Tier | Target org size | Included | Seat pricing model |
|---|---|---|---|
| **Starter** | 2–8 technicians | Core Operations: Jobs, Scheduling, Dispatch, Estimates, Invoicing, Payments, basic Customer Portal | Flat monthly base + per-technician seat |
| **Growth** | 8–25 technicians | Starter + Inventory, multi-team Scheduling, Analytics dashboards, Integrations (QuickBooks sync) | Flat monthly base + per-technician seat, higher included limits |
| **Pro** | 25–50 technicians | Growth + advanced reporting, priority support, expanded API access, custom Job Types/forms | Flat monthly base + per-technician seat |

Marketplace, Manufacturer Integrations, and Financial Services (Phases 4–6) introduce **usage-based or transaction-based pricing** layered on top of the seat subscription once those pillars ship — e.g., a marketplace order take-rate, a payment processing margin already implicit in Payments. These are not part of the launch pricing model itself. See [Business Objectives](../00-overview/business-objectives.md).

## Pricing principles

1. **Price by seat, not by data volume.** Properties, Assets, Jobs, and Documents are not metered or capped by tier — the core value proposition (a durable property/asset record) must never be throttled by pricing, or the Property Intelligence thesis is undermined before it starts.
2. **No feature that affects data integrity or security is tier-gated.** Audit logging, RLS-enforced tenant isolation, and backups apply identically at every tier.
2a. Reporting depth, integration count, and support SLA are legitimate tier differentiators; correctness and security are not.
3. **Payments pricing is transparent and pass-through-plus-margin**, not hidden in the subscription — Organizations should be able to see processor fees separately from the Atlas subscription. See [Payments PRD](../06-modules/payments-prd.md).
4. **No long-term lock-in on data.** Regardless of tier, an Organization can export its full data set (see [API Overview](../05-api/api-overview.md)) — this is a trust requirement, not solely a pricing one (see [Product Principles](../00-overview/product-principles.md), principle 9).

## Packaging non-decisions (deferred to business/GTM, not resolved by this documentation)

- Exact price points per tier and per seat.
- Whether annual billing carries a discount.
- Free trial length and conversion mechanics.
- Whether a free/forever tier exists for the smallest (1–2 technician) businesses.

These are flagged as **open questions requiring human/business approval** — see [`DOCUMENTATION-CONSISTENCY-REPORT.md`](../DOCUMENTATION-CONSISTENCY-REPORT.md).

## Relationship to success metrics

Pricing tier boundaries should track the segments defined in [Target Customers](../00-overview/target-customers.md) and be validated against the activation/retention metrics in [Success Metrics](./success-metrics.md), not set independently of observed usage.
