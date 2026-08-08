# Vision

## The 10-year vision

Field-service trades — plumbing, HVAC, electrical, and adjacent trades — run the physical infrastructure of every building in the country, yet they operate on fragmented point tools: a scheduling app, a QuickBooks integration, a supplier's ordering portal, a manufacturer's warranty lookup, spreadsheets for compliance, and phone calls for everything in between. No system of record ties the **property**, the **equipment inside it**, the **work performed on it**, and the **commercial relationships around it** (suppliers, manufacturers, financing, insurance) into one durable data asset.

Project Atlas's vision is to become the **operating platform for field-service businesses** — the system every plumbing, HVAC, and electrical company runs on, and over time the data and commerce layer that connects those businesses to their suppliers, the equipment manufacturers whose products they install, and the financial institutions that fund the work.

We are not building "AI to replace technicians" or an AI-first workforce product. AI, where it appears, is a supporting capability layered onto a correct, durable operational and data foundation — not the reason the product exists. See [Product Principles](./product-principles.md).

## Why a platform, not an app

A scheduling app makes a technician's day easier. A **platform** makes every job ever performed on a property permanently useful: to the next technician who visits, to the customer deciding whether to repair or replace, to the manufacturer honoring a warranty, to the supplier restocking a truck, and to the lender assessing a financed repair. Value compounds only if the underlying data model treats the **property and its assets as first-class, persistent entities** that outlive any single job — see [Properties](../03-domain/properties.md) and [Assets](../03-domain/assets.md).

## The six pillars of the long-term platform

Project Atlas is architected from day one so these six pillars can be built on the same domain model and database, without a rewrite:

1. **Core Operations** — scheduling, dispatch, jobs, estimates, invoicing, payments. The operational backbone every field-service business needs on day one. See [Roadmap Phase 2](../13-roadmap/phase-2-core-operations.md).
2. **Property Intelligence** — properties, buildings, rooms, and assets as durable records with full service history, enabling predictive maintenance and asset lifecycle insight. See [Roadmap Phase 3](../13-roadmap/phase-3-property-intelligence.md).
3. **Supplier Marketplace** — connecting service businesses to parts suppliers directly inside the workflow where parts are needed. See [Roadmap Phase 4](../13-roadmap/phase-4-marketplace.md).
4. **Manufacturer Integrations** — warranty registration, product catalogs, and installation compliance tied directly to the asset record. See [Roadmap Phase 5](../13-roadmap/phase-5-manufacturers.md).
5. **Financial Services** — financing for customers, faster payouts for contractors, and embedded finance built on trustworthy job and payment history. See [Roadmap Phase 6](../13-roadmap/phase-6-financial-services.md).
6. **Industry Data Network** — aggregate, de-identified data on equipment lifespan, regional service trends, and pricing that benefits every participant in the network. See [Roadmap Phase 7](../13-roadmap/phase-7-industry-network.md).

Every pillar depends on the one before it. We do not build pillar 3 before pillar 1 is solid — see [Implementation Roadmap](../13-roadmap/implementation-roadmap.md) for sequencing and dependencies.

## What "trade-aware, not trade-specific" means

Plumbing, HVAC, and electrical are the launch trades, but the platform is never architected around any one of them. A single generic domain model — configurable trade types, asset types, job types, checklists, forms, and pricing — serves all three without forked codebases or trade-specific tables. See [ADR-009: Domain Modules over Trade Verticals](../11-adr/ADR-009-domain-modules.md).

## What we are explicitly not building

- Not a general-purpose field-service framework for every industry (e.g., landscaping, cleaning) at launch — those are plausible future trades, not day-one scope. See [Product Scope](../01-product/product-scope.md).
- Not an "AI workforce" or autonomous-agent product. See [Product Principles](./product-principles.md).
- Not a hardware or IoT sensor company. Asset telemetry integration is a future extension, not core scope.
