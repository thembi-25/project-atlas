# Product Strategy

## Strategy summary

Win the plumbing/HVAC/electrical trades segment with a genuinely complete Core Operations product, then use the resulting property/asset/job data asset to expand into Property Intelligence, Marketplace, Manufacturer Integrations, Financial Services, and the Industry Data Network — in that order, each gated by the previous pillar's maturity. See [Vision](../00-overview/vision.md), [Business Objectives](../00-overview/business-objectives.md).

## Strategic pillars and sequencing rationale

1. **Core Operations must be undeniably better than a whiteboard and a spreadsheet**, not just "as good as" incumbent FSM tools. Feature parity is not the bar; removing the office's daily manual reconciliation work is.
2. **Property Intelligence only has value once there's real job history to mine.** An empty asset record is worthless. We therefore treat Phase 2 (Core Operations) as also seeding Phase 3's data requirements — Jobs must always be able to link to Assets/Properties even before Property Intelligence features exist. See [Assets](../03-domain/assets.md).
3. **Marketplace and Manufacturer Integrations require trust with third parties**, which requires a credible base of active organizations transacting jobs. These pillars are commercially and technically premature before Phase 2 is stable in production. See [Roadmap Phase 4](../13-roadmap/phase-4-marketplace.md), [Roadmap Phase 5](../13-roadmap/phase-5-manufacturers.md).
4. **Financial Services requires underwritable history** (job volume, payment reliability) that only exists after real usage. See [Roadmap Phase 6](../13-roadmap/phase-6-financial-services.md).
5. **Industry Data Network is the most compliance-sensitive pillar** (aggregated customer/property data) and is deliberately last, pending an explicit data-rights and consent framework. See [Roadmap Phase 7](../13-roadmap/phase-7-industry-network.md).

## Build vs. buy strategy

- **Build**: the core domain model (Organizations, Properties, Assets, Jobs, Scheduling, Estimates, Invoices), because this is the product's actual differentiation and cannot be outsourced to a vendor.
- **Buy/integrate**: payments (Stripe), transactional email/SMS (Resend/Twilio), authentication primitives (Supabase Auth), file storage (Supabase Storage), accounting sync (QuickBooks Online API) — see [Integrations PRD](../06-modules/integrations-prd.md) and relevant ADRs in [`11-adr/`](../11-adr/).
- We do not build a payments processor, an SMS gateway, or an identity provider from scratch. See [Architecture Principles](../02-architecture/architecture-principles.md), principle on avoiding unjustified infrastructure.

## Platform strategy: why trade-agnostic architecture matters commercially, not just technically

If Atlas were architected plumbing-first, adding HVAC and electrical would mean duplicated schemas and duplicated product surfaces — doubling engineering cost per trade added and making the eventual Property Intelligence pillar incoherent (a property with both an HVAC condenser and a plumbing water heater must be one record, not two trade-siloed ones). The generic, configuration-driven domain model (see [ADR-009](../11-adr/ADR-009-domain-modules.md)) is therefore a commercial strategy, not just an engineering preference: it is what makes adding a fourth and fifth trade cheap, and what makes Property Intelligence possible at all.

## Competitive strategy

We do not attempt to out-feature incumbent FSM tools point-by-point. See [Market Positioning](../00-overview/market-positioning.md) for the specific differentiation thesis (property-centric data model, trade-agnostic architecture, platform roadmap). Feature requests that only chase competitor parity without serving the Core Operations or Property Intelligence thesis are deprioritized against the roadmap in [`13-roadmap/`](../13-roadmap/).

## Risks to the strategy

- **Sequencing risk**: pressure to build Marketplace/AI features before Core Operations is solid, driven by more exciting demos. Mitigated by the explicit phase-gating in [Implementation Roadmap](../13-roadmap/implementation-roadmap.md).
- **Scope creep risk**: field-service businesses have highly varied edge-case workflows; without disciplined scope boundaries (see [Product Scope](./product-scope.md)) the "trade-agnostic platform" ambition can balloon into unbounded configurability that is never fully built.
