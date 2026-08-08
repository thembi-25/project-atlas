# ADR-020: AI as an Assistive, Draft-Only Capability

## Status

Accepted

## Date

2026-08-08

## Context

The product brief for Project Atlas is explicit: **Atlas is not an AI workforce product**; AI may eventually be a supporting capability, but it is not the primary product differentiator (see [Vision](../00-overview/vision.md), [Product Principles](../00-overview/product-principles.md), principle 4). This ADR exists specifically to make that constraint an architectural decision, not just a marketing position, so future implementation work has a clear, binding boundary.

## Problem

Where and how should AI capability be integrated into Atlas's architecture, if at all, without it becoming a de facto core dependency of the product's operational workflows?

## Decision

AI capability, if and when built (not launch scope — see [AI Platform PRD](../06-modules/ai-platform-prd.md)), is restricted to **draft-only, human-confirmed assistance** on top of the existing structured data model. No AI-generated content is ever persisted to a domain entity without explicit human confirmation through the same validation/save path a manually entered value would use. No core workflow (Job execution, Estimate creation, Invoicing, Payment) may ever require an AI feature to function.

## Alternatives Considered

1. **AI as a first-class autonomous agent** (e.g., an agent that schedules jobs, drafts and sends estimates, or makes dispatch decisions without per-action human confirmation) — rejected outright. Directly contradicts the product's core positioning and principles; would also introduce exactly the kind of unpredictable, hard-to-audit behavior that conflicts with Atlas's emphasis on auditability and human accountability (see [Product Principles](../00-overview/product-principles.md), principles 4 and 6).
2. **No AI capability at all, ever** — rejected as too restrictive; some genuinely assistive uses (voice-to-text job note drafting, history summarization) are legitimate future value adds that don't compromise the core positioning, provided they stay draft-only and optional.
3. **AI deeply embedded in core domain logic** (e.g., AI-driven pricing suggestions presented as the default/authoritative Estimate total) — rejected. Blurs the line between assistance and decision-making in the one area (money) where Atlas's principles are strictest about human-verified accuracy (see [Product Principles](../00-overview/product-principles.md), principle 7).

## Consequences

- Any future AI feature is additive to, not load-bearing for, Atlas's core workflows — a Technician can always complete their entire day without touching an AI feature.
- AI-generated content is marked with its provenance (`generated_by = 'ai_assist'`) in Audit Events when accepted, keeping the audit trail's accountability model intact even for AI-assisted entries — see [AI Platform PRD](../06-modules/ai-platform-prd.md).
- Product/marketing decisions are constrained by this ADR: Atlas is never positioned with "AI-powered" as its primary claim (see [Market Positioning](../00-overview/market-positioning.md)).

## Risks

- Commercial/competitive pressure to lead with AI features more aggressively than this ADR allows — this ADR exists precisely to require a new, explicit decision (and likely a new ADR) before that boundary is crossed, rather than letting it erode feature-by-feature.

## Migration / Rollback

Expanding AI capability beyond drafting assistance requires a new ADR explicitly revisiting this decision and [Product Principles](../00-overview/product-principles.md) principle 4 — it is not something an individual feature PR can do unilaterally.

## Related Decisions

[AI Platform PRD](../06-modules/ai-platform-prd.md) · [Product Principles](../00-overview/product-principles.md) · [Vision](../00-overview/vision.md) · [Audit Events](../03-domain/audit-events.md)
