# Implementation Roadmap

## Purpose

The authoritative, phased build plan for Project Atlas. **The canonical numbering used throughout this roadmap — Strategic Product Phases, Technical Implementation Phases, and Sprints — is defined in [`ROADMAP-DECISION.md`](./ROADMAP-DECISION.md). Read that document first.** This document is the narrative build plan; `ROADMAP-DECISION.md` is the numbering authority it defers to.

## The three numbering schemes, in one sentence each

- **Strategic Product Phases** (1–6): the six long-term product pillars from [Vision](../00-overview/vision.md) — Core Operations, Property Intelligence, Supplier Marketplace, Manufacturer Integrations, Financial Services, Industry Data Network. Business/product milestones, never technical sequencing.
- **Technical Implementation Phases** (1–7): the seven build-plan files in this directory, including an Engineering Foundation phase that has no Strategic Phase of its own. Technical Phase *N* implements Strategic Phase *N − 1* for N ≥ 2.
- **Sprints**: the granular execution unit within a Technical Implementation Phase — see [`ROADMAP-DECISION.md`](./ROADMAP-DECISION.md), Section C.

Do not use a bare word "Phase" anywhere in engineering planning without saying *which* of these three you mean.

## Technical Implementation Phase index

| Technical Phase | File | Implements (Strategic Phase) |
|---|---|---|
| 1 — Engineering Foundation | [phase-1-foundation.md](./phase-1-foundation.md) | *(prerequisite only)* |
| 2 — Core Operations Build | [phase-2-core-operations.md](./phase-2-core-operations.md) | Strategic Phase 1: Core Operations |
| 3 — Property Intelligence Build | [phase-3-property-intelligence.md](./phase-3-property-intelligence.md) | Strategic Phase 2: Property Intelligence |
| 4 — Supplier Marketplace Build | [phase-4-marketplace.md](./phase-4-marketplace.md) | Strategic Phase 3: Supplier Marketplace |
| 5 — Manufacturer Integrations Build | [phase-5-manufacturers.md](./phase-5-manufacturers.md) | Strategic Phase 4: Manufacturer Integrations |
| 6 — Financial Services Build | [phase-6-financial-services.md](./phase-6-financial-services.md) | Strategic Phase 5: Financial Services |
| 7 — Industry Data Network Build | [phase-7-industry-network.md](./phase-7-industry-network.md) | Strategic Phase 6: Industry Data Network |

## Dependency graph

See [`ROADMAP-DECISION.md`](./ROADMAP-DECISION.md), Section D, for the full Strategic Phase dependency diagram, the Sprint-level dependency diagram for the MVP (Sprints 0–7), and the specific readiness criteria gating each transition (Sprint 7 → Sprint 8+, and Strategic Phase 1 → Strategic Phases 3/4/5, and Phases 2–5 → Phase 6).

The short version: Technical Phase 1 blocks everything. Technical Phase 2 (MVP) blocks all of Strategic Phases 2–5, which do not block each other. Strategic Phase 6 depends on Phases 2–5 all being substantially mature, plus its own independent legal/data-rights prerequisite.

## What "launch" means

Launch = Technical Implementation Phases 1 and 2 complete = Strategic Phase 1 (Core Operations) live in Production = Sprints 0 through 7 done. See [`ROADMAP-DECISION.md`](./ROADMAP-DECISION.md), Section E, for the exact MVP scope, and Section F for everything explicitly deferred past it.

## Early sprints

Sprints 0–2 have their own detailed documents: [Sprint 0](./sprint-0.md), [Sprint 1](./sprint-1.md), [Sprint 2](./sprint-2.md). Sprints 3–7 are scoped at a summary level in [`ROADMAP-DECISION.md`](./ROADMAP-DECISION.md), Section C.1, with detailed sprint documents to be authored as each sprint begins — not pre-written speculatively ahead of what's learned building the sprints before them.

## Backlog

Cross-phase, not-yet-scheduled items are tracked in [Implementation Backlog](./implementation-backlog.md).

## Why this order, restated

See [Product Strategy](../01-product/product-strategy.md) for the full sequencing rationale: Core Operations must be trustworthy before Property Intelligence has data worth mining; Marketplace/Manufacturer partnerships need a credible active-Organization base; Financial Services needs underwritable history; the Industry Data Network is the most compliance-sensitive pillar and is deliberately last.
