# AI Platform — PRD

## 1. Purpose

Define the boundaries and design of Atlas's AI-assisted capabilities. This PRD exists specifically to constrain scope: Project Atlas is an operations and data platform, and AI is a supporting capability layered on top of structured, human-verifiable data — never the product's core value proposition. See [Product Principles](../00-overview/product-principles.md), principle 4, and [ADR-020: AI Architecture](../11-adr/ADR-020-ai-architecture.md).

## 2. Business problem

Some genuinely tedious tasks (drafting a Job description from voice/text notes, summarizing a long Job history before a return visit) are well-suited to AI assistance — but only where the human stays in control of the final action and the underlying data remains the trustworthy, structured system of record regardless of whether AI assisted in producing it.

## 3. Goals

- Where AI assists, it drafts; a human reviews and confirms before anything is written to the system of record.
- AI features are additive conveniences, never a required path to complete a core workflow (a Technician must always be able to complete a Job without ever touching an AI feature).
- No AI feature is positioned as autonomous decision-making on financial, scheduling, or dispatch actions.

## 4. Non-goals

- Autonomous AI agents that take action on a User's behalf without explicit per-action confirmation.
- AI-driven pricing/estimating decisions presented as authoritative without human review.
- Any marketing or product positioning that leads with "AI-powered" as Atlas's primary value claim — see [Market Positioning](../00-overview/market-positioning.md).
- This module is explicitly **not launch scope** (Phase 1–2) — see [Product Scope](../01-product/product-scope.md).

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md) (drafting assistance), [Denise (Dispatcher)](../00-overview/user-personas.md) (summarization assistance).

## 6. User stories (candidate, post-launch)

As a Technician, I want to dictate my job notes and have them turned into a structured summary I can review and edit, so I don't have to type on a small screen after a physically demanding job.

## 7. Functional requirements (candidate, post-launch)

Draft-only text generation for Job notes/descriptions from voice input; Job/Property history summarization for a Technician about to start a return visit — always presented as an editable draft, never auto-submitted.

## 8. Business rules

Any AI-generated content written to a domain entity (a Job description, an Estimate line-item description) is marked with its origin (`generated_by = 'ai_assist'`) in the [Audit Event](../03-domain/audit-events.md) diff, and requires the same human confirmation step as manual entry — there is no code path where AI output reaches the database without passing through the same validation and confirmation UI a human-typed entry would.

## 9. State machines

None — AI-assist features produce draft text, not entities with their own lifecycle.

## 10. Data requirements

No AI-specific tables beyond the `generated_by` provenance marker on relevant Audit Event diffs; no Job/Customer data is used to train any model, and any AI provider used is bound by a data-processing agreement prohibiting training on Atlas customer data.

## 11. API requirements (candidate, post-launch)

`POST /api/v1/ai/draft-job-summary` (input: raw notes; output: draft text only, never a direct entity write).

## 12. Permission requirements

Same Role-based access as the underlying entity being drafted for (a Technician can request an AI draft only for Jobs they're assigned to).

## 13. UI requirements

Any AI-generated content is visually distinguished (e.g., a labeled "AI draft" state) until a human explicitly accepts/edits it into the real field.

## 14. Notifications

None.

## 15. Audit requirements

Every AI-assisted draft that is accepted and saved is marked in its Audit Event as AI-originated content, distinct from manually authored content, for future transparency/dispute purposes.

## 16. Error cases

AI service unavailable — the manual entry path remains fully functional; AI assistance degrading or failing never blocks a core workflow, per Goal 2.

## 17. Edge cases

An AI-drafted Job summary contains a factual error (misheard voice input) — because it's always presented as an editable draft requiring explicit confirmation, this is a normal, expected correction step, not a data-integrity incident, since nothing is written until confirmed.

## 18. Acceptance criteria (candidate, post-launch)

**Given** an AI-drafted Job note, **when** a Technician has not yet confirmed it, **then** no Job field is modified — the draft exists only in the UI/request-response cycle, never persisted as the Job's actual description until explicit save.

## 19. Testing requirements

Tests confirming AI draft output never auto-persists; tests confirming every core workflow (Job completion, Estimate creation, Invoicing) functions correctly with AI features entirely disabled/unavailable.

## 20. Future extensions

Diagnostic-suggestion assistance from historical Job/Asset patterns (still human-reviewed); semantic search across Job notes (ties to [Search Strategy](../02-architecture/search-strategy.md), `pgvector` future option). Any expansion beyond drafting assistance requires a new ADR and explicit re-evaluation against [Product Principles](../00-overview/product-principles.md) principle 4 before being added to this PRD's scope.
