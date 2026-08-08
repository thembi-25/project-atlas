# Business Objectives

## Strategic objective

Become the system of record for small-to-midsize plumbing, HVAC, and electrical service businesses in the U.S. market, then expand the commercial surface area (marketplace, manufacturer integrations, financial services, data network) on top of that installed base. See [Vision](./vision.md).

## Business model

- **Primary revenue**: SaaS subscription, tiered by technician/user seat count and feature tier (see [Pricing Strategy](../01-product/pricing-strategy.md)).
- **Secondary revenue (future phases)**: transaction take-rate on marketplace orders ([Marketplace PRD](../06-modules/marketplace-prd.md)), payment processing margin ([Payments PRD](../06-modules/payments-prd.md)), and referral/placement fees on financial services products ([Roadmap Phase 6](../13-roadmap/phase-6-financial-services.md)).
- Revenue diversification is sequenced deliberately: transactional and data-network revenue only becomes viable once there is a real base of active organizations transacting jobs through Core Operations. We do not build monetizable marketplace or lending features before there is usage to monetize.

## Year-one objectives (post-launch)

1. Prove product-market fit with a focused segment: independent plumbing, HVAC, and electrical businesses with 2–50 technicians. See [Target Customers](./target-customers.md).
2. Achieve reliable, correct Core Operations (scheduling, dispatch, jobs, estimates, invoicing, payments) before any pillar-2+ feature ships to production. See [Implementation Roadmap](../13-roadmap/implementation-roadmap.md).
3. Establish the property/asset data model as a genuine data asset — measured by percentage of jobs linked to a tracked property and asset, not just percentage of jobs scheduled.
4. Maintain multi-tenant data integrity and security posture suitable for handling customer PII and payment data from day one — not retrofitted later. See [Security Architecture](../07-security/security-architecture.md).

## Multi-year objectives

1. Expand Property Intelligence into a genuine differentiator: predictive maintenance signals, asset lifecycle reporting, and richer property records that make Atlas customers' quotes more accurate and their upsell conversations more credible.
2. Launch the Supplier Marketplace as an embedded, not bolted-on, part of the job/parts workflow.
3. Establish manufacturer partnerships for warranty registration and compliance data exchange.
4. Evaluate financial services (financing, faster payouts) once there is sufficient job/payment history per organization to underwrite responsibly.
5. Explore an aggregated, de-identified Industry Data Network only after privacy, consent, and data-rights frameworks are explicitly designed — this is the most compliance-sensitive pillar and the last to be built.

## Non-objectives

- We do not optimize for maximum feature breadth at launch. Functional scope for v1 is bounded — see [Product Scope](../01-product/product-scope.md).
- We do not pursue enterprise/multi-thousand-technician franchises as an initial segment; the information architecture should not preclude it, but the product is not designed for it first. See [Market Positioning](./market-positioning.md).
- We do not treat AI capability as a standalone objective or KPI. See [Product Principles](./product-principles.md).

## How success is measured

See [Success Metrics](../01-product/success-metrics.md) for the specific, module-level metrics (activation, job-cycle time, invoice-to-payment time, property/asset coverage, retention) used to evaluate progress against these objectives.
