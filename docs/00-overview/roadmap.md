# Roadmap (Executive Summary)

This is a high-level pointer document. The authoritative roadmap numbering — Strategic Product Phases, Technical Implementation Phases, and Sprints, kept deliberately distinct — is defined in [`13-roadmap/ROADMAP-DECISION.md`](../13-roadmap/ROADMAP-DECISION.md). The full build plan lives in [`13-roadmap/implementation-roadmap.md`](../13-roadmap/implementation-roadmap.md).

## The six strategic product pillars

| Strategic Phase | Pillar |
|---|---|
| Strategic Phase 1 | Core Operations |
| Strategic Phase 2 | Property Intelligence |
| Strategic Phase 3 | Supplier Marketplace |
| Strategic Phase 4 | Manufacturer Integrations |
| Strategic Phase 5 | Financial Services |
| Strategic Phase 6 | Industry Data Network |

Strategic Phase 1 is the MVP. Strategic Phases 2–6 are all post-launch. See [Vision](./vision.md) for the full framing of each pillar.

## How strategic pillars map to the engineering build plan

Engineering work is organized into **Technical Implementation Phases** (one build-plan file per phase, in [`13-roadmap/`](../13-roadmap/)), which is one phase longer than the strategic list above because it includes a prerequisite Engineering Foundation phase that isn't itself a product pillar:

| Technical Implementation Phase | Build file | Implements |
|---|---|---|
| Technical Phase 1 | [phase-1-foundation.md](../13-roadmap/phase-1-foundation.md) | Prerequisite for all Strategic Phases — architecture, multi-tenancy, identity, organizations, permissions |
| Technical Phase 2 | [phase-2-core-operations.md](../13-roadmap/phase-2-core-operations.md) | Strategic Phase 1: Core Operations |
| Technical Phase 3 | [phase-3-property-intelligence.md](../13-roadmap/phase-3-property-intelligence.md) | Strategic Phase 2: Property Intelligence |
| Technical Phase 4 | [phase-4-marketplace.md](../13-roadmap/phase-4-marketplace.md) | Strategic Phase 3: Supplier Marketplace |
| Technical Phase 5 | [phase-5-manufacturers.md](../13-roadmap/phase-5-manufacturers.md) | Strategic Phase 4: Manufacturer Integrations |
| Technical Phase 6 | [phase-6-financial-services.md](../13-roadmap/phase-6-financial-services.md) | Strategic Phase 5: Financial Services |
| Technical Phase 7 | [phase-7-industry-network.md](../13-roadmap/phase-7-industry-network.md) | Strategic Phase 6: Industry Data Network |

**Rule of thumb**: Technical Implementation Phase *N* implements Strategic Phase *N − 1*, for N ≥ 2. Technical Phase 1 is the one exception — it's pure engineering prerequisite, not a pillar.

Each Technical Phase is strictly dependent on the ones before it — see [`ROADMAP-DECISION.md`](../13-roadmap/ROADMAP-DECISION.md), Section D, for the explicit dependency graph and readiness criteria. Technical Phases 1 and 2 (together, the MVP) are further broken into [Sprint 0](../13-roadmap/sprint-0.md) through Sprint 7 — see [`ROADMAP-DECISION.md`](../13-roadmap/ROADMAP-DECISION.md), Section C.

## What "launch" means

Launch is the completion of Technical Implementation Phase 2 (Core Operations Build) on top of Technical Implementation Phase 1 (Engineering Foundation) — equivalently, Strategic Phase 1 live in Production. Strategic Phases 2–6 are explicitly post-launch and are not built simultaneously with launch scope — see [Product Scope](../01-product/product-scope.md) and [Business Objectives](./business-objectives.md).
