# Documentation Consistency Report

This report is the output of the review passes over the Project Atlas documentation set. It records what was created, the major decisions embedded in it, what was found and fixed during review, what remains genuinely open, and what a human should decide before implementation begins.

**Revision history**: Round 1 (initial documentation generation and review) is preserved below. Round 2 (roadmap ambiguity resolution, this revision) is recorded in its own section and reflected throughout the rest of this document, which has been updated in place rather than left contradicting the resolution.

## Round 2: Roadmap ambiguity — resolved

The roadmap-numbering ambiguity flagged in Round 1 (see "Major Assumptions," item 2 below) has been **resolved and accepted**. [`13-roadmap/ROADMAP-DECISION.md`](./13-roadmap/ROADMAP-DECISION.md) is now the authoritative document establishing three deliberately distinct numbering schemes:

- **Strategic Product Phases (1–6)** — the six long-term product pillars: Phase 1 Core Operations, Phase 2 Property Intelligence, Phase 3 Supplier Marketplace, Phase 4 Manufacturer Integrations, Phase 5 Financial Services, Phase 6 Industry Data Network.
- **Technical Implementation Phases (1–7)** — the seven build-plan files in `13-roadmap/` (filenames unchanged), where Technical Phase 1 is a prerequisite Engineering Foundation phase with no Strategic Phase of its own, and Technical Phase *N* implements Strategic Phase *N − 1* for N ≥ 2.
- **Sprints** — the granular execution unit; Sprint 0 through Sprint 7 cover the MVP (Technical Phases 1–2 / Strategic Phase 1), Sprint 8+ begins Property Intelligence, and later Strategic Phases are deliberately not pre-broken into sprints.

**What changed to implement this resolution:**
- Created `13-roadmap/ROADMAP-DECISION.md` (sections A–F: Strategic Product Phases, Technical Implementation Phases, Sprints, Dependencies, MVP scope, deferred scope).
- Rewrote `13-roadmap/implementation-roadmap.md` and `00-overview/roadmap.md` to defer to `ROADMAP-DECISION.md` as the numbering authority.
- Added a distinguishing banner to each of the 7 `13-roadmap/phase-N-*.md` files stating its Technical Implementation Phase number and which Strategic Phase (if any) it implements.
- Updated `13-roadmap/implementation-backlog.md` and `sprint-0.md`/`sprint-1.md`/`sprint-2.md` for consistent terminology and forward references to the (not-yet-authored) Sprint 3–7 documents, whose scope is summarized in `ROADMAP-DECISION.md`, Section C.1.
- Corrected roughly 60 individual cross-references across 25+ files outside `13-roadmap/` that used the old, since-superseded "Roadmap Phase N" numbering (where, e.g., "Roadmap Phase 4" meant Marketplace) to the new "Strategic Phase N−1" numbering (Marketplace is now Strategic Phase 3) — verified programmatically, with zero old-scheme references remaining outside this report's own historical record below.
- Re-ran the full relative-link scan (see Round 2 verification, below).

**Architecture decisions explicitly reaffirmed (KEEP), not reopened by this round:** modular monolith; Next.js + TypeScript + Supabase/PostgreSQL; Drizzle ORM; Supabase Auth; membership-based PostgreSQL RLS; fixed platform-defined RBAC at launch; trade-agnostic domain model; versioned REST API at `/api/v1/`; transactional outbox + `pg-boss`; database-trigger-based audit logging; PostgreSQL-first search and caching; Stripe/Resend/Twilio/QuickBooks Online as integration defaults; PWA mobile strategy; draft-only human-confirmed AI architecture; no microservices/Kafka/Redis/Elasticsearch/Kubernetes/GraphQL/other infrastructure without a future ADR explicitly justifying it. None of these were contradicted by the roadmap-numbering fix — the fix was purely a documentation-clarity issue, not an architectural one.

## Round 2 verification

- Full relative-link scan re-run across all 198 files: zero genuinely broken links (one flagged match is `docs/README.md`'s illustrative inline-code example of the link-syntax convention itself, not a real link).
- Zero remaining `Roadmap Phase N` references outside this report's own historical Round 1 record (below) and `13-roadmap/`'s internal, now-disambiguated usage.
- Zero remaining bare `Phase 3`–`Phase 7` references that could be confused with the old numbering scheme, outside this report's historical record.
- No double-prefixed artifacts (e.g., "Strategic Strategic Phase" or "Technical Strategic Phase") introduced by the correction pass.
- PRD section-count and ADR template-compliance checks re-run: unaffected, still 26/26 and 26/26 compliant.

## Round 1: Documents created

**198 Markdown files** across 15 sections (197 spec/report documents plus `ROADMAP-DECISION.md` added in Round 2):

| Section | Files | Section | Files |
|---|---|---|---|
| `docs/README.md` | 1 | `07-security/` | 9 |
| `docs/DOCUMENTATION-CONSISTENCY-REPORT.md` | 1 | `08-engineering/` | 9 |
| `00-overview/` | 10 | `09-testing/` | 8 |
| `01-product/` | 8 | `10-devops/` | 9 |
| `02-architecture/` | 12 | `11-adr/` | 26 |
| `03-domain/` | 28 | `12-claude/` | 12 |
| `04-database/` | 13 | `13-roadmap/` | 13 (12 original + `ROADMAP-DECISION.md`) |
| `05-api/` | 13 | `06-modules/` | 26 |

Every module PRD in `06-modules/` contains all 20 required sections (Purpose through Future Extensions), verified programmatically. Every ADR in `11-adr/` contains all 10 required template sections (Status through Related Decisions), verified programmatically.

## Major architecture decisions (see `11-adr/` for full rationale)

- **Modular monolith**, one Next.js app + one background worker, in a single monorepo — not microservices (ADR-001, ADR-002).
- **TypeScript strict mode**, **PostgreSQL via Supabase**, **Drizzle ORM** (ADR-003, ADR-004, ADR-005).
- **Supabase Auth** for authentication; **Row Level Security, membership-based** (not JWT-claim-based) as the tenant-isolation mechanism (ADR-006, ADR-007).
- **Fixed platform-defined RBAC Roles** (Owner, Admin, Dispatcher, Technician, Accountant, Read Only) — no custom per-Organization roles at launch (ADR-008).
- **Trade-agnostic domain model**: one schema for all trades, differentiated by configuration (`trade_types`, `job_types`, `asset_types`, checklists), not forked code (ADR-009).
- **API-first**: the first-party app consumes the same versioned `/api/v1/` REST API any third party would (ADR-010, ADR-023).
- **Narrow internal domain events** (Postgres transactional outbox + `pg-boss`), not event sourcing or a message broker (ADR-011, ADR-016).
- **Synchronous, trigger-based audit logging** — `audit_events` is populated by database triggers, never solely by application code (ADR-012).
- **No Redis, no dedicated search service, no Kafka/message broker at launch** — PostgreSQL capabilities used first, with documented triggers for reconsidering each (ADR-014, ADR-015).
- **Stripe** for payments, **Resend/Twilio** for notifications, **QuickBooks Online** for accounting sync (ADR-017, ADR-018).
- **AI is draft-only and human-confirmed**, never autonomous, never the product's core differentiator (ADR-020) — this is the direct architectural translation of the brief's explicit "not an AI workforce product" instruction.
- **PWA, not native**, for the Technician mobile experience (ADR-024).
- **Vercel + Supabase + a small persistent worker host**, deployed via a staged CI/CD pipeline with manual Production promotion (ADR-026).

All of the above were explicitly reaffirmed by the user at the start of Round 2 (see "Round 2: Roadmap ambiguity — resolved," KEEP list) and are not open for reconsideration absent a future ADR.

## Major assumptions made

1. **ORM choice (Drizzle over Prisma)** — reasoned default in ADR-004; low-risk, easily revisited before significant code is written.
2. ~~**Roadmap Phase numbering reconciliation**~~ — **RESOLVED in Round 2.** See "Round 2: Roadmap ambiguity — resolved," above, and [`13-roadmap/ROADMAP-DECISION.md`](./13-roadmap/ROADMAP-DECISION.md). No longer an open assumption.
3. **Pricing tier structure** — a directional 3-tier (Starter/Growth/Pro) seat-based model is documented in `01-product/pricing-strategy.md` as a framework, explicitly not as final pricing. **Requires business decision.**
4. **Manufacturers as platform-shared (cross-tenant) reference data** — the one deliberate exception to strict per-Organization data ownership, justified in `03-domain/manufacturers.md` on the grounds that manufacturer identity is a real-world fact, not tenant-specific data.
5. **7-year financial / 3-year operational audit retention** — reasoned default in `04-database/audit-logging.md` based on typical U.S. small-business record-keeping norms, not a confirmed legal requirement. **Requires compliance/legal confirmation.**
6. **U.S.-only launch scope** (tax, currency, compliance) — consistent with the target customer segment in `00-overview/target-customers.md`; treated as a firm launch-scope boundary, not merely a suggestion.

## Open questions requiring human/business approval

Tracked in full in `13-roadmap/implementation-backlog.md`; the highest-priority ones:

1. Exact pricing tier price points and whether a free tier exists.
2. Production domain name and branding assets (referenced as a placeholder in `05-api/api-overview.md`).
3. External penetration test scheduling and budget (`09-testing/security-testing.md`).
4. Strategic Phase 6 (Industry Data Network)'s data-rights/consent legal framework — explicitly gated as a prerequisite to any implementation work on that phase, not something engineering can resolve unilaterally (`13-roadmap/phase-7-industry-network.md`).
5. Whether Strategic Phases 2–5 (Property Intelligence, Supplier Marketplace, Manufacturer Integrations, Financial Services) should be resequenced relative to each other based on actual partnership/business development progress once Strategic Phase 1 ships — the documented default order follows the stated business rationale (`01-product/product-strategy.md`) but is not a rigid commitment. See `13-roadmap/ROADMAP-DECISION.md`, Section D, for why these four don't depend on each other.

Item 6 (confirmation of the Round 1 roadmap numbering interpretation) from the prior revision of this report is now closed — see Round 2.

## Known risks (see `07-security/threat-model.md` for the full model)

1. **RLS policy correctness is the platform's single highest-stakes ongoing engineering risk** — mitigated architecturally by mandatory cross-tenant isolation tests on every tenant-owned table, but this requires sustained engineering discipline, not a one-time fix.
2. **Trade-agnostic configuration model complexity** — as more trades and Organization-specific customization accumulate, the configuration-over-code-branching discipline (ADR-009) requires active maintenance to avoid quietly degrading into hard-coded exceptions.
3. **Vendor concentration** — Supabase (database/auth/storage), Vercel (hosting), and Stripe (payments) are each load-bearing dependencies with no redundant fallback at launch scale; accepted per the anti-overengineering principle but worth revisiting as the business scales.
4. **Documentation-implementation drift** — this entire set was authored before any code exists; `08-engineering/documentation-standards.md` and `12-claude/documentation-instructions.md` establish the discipline to keep them in sync, but that discipline has not yet been tested against real implementation pressure.
5. **Roadmap-numbering drift (new, Round 2)** — now that `ROADMAP-DECISION.md` exists as the numbering authority, any future document that introduces a new "Phase" reference must state explicitly which of the three schemes (Strategic/Technical/Sprint) it means. This is now an explicit rule in `08-engineering/documentation-standards.md` and `12-claude/documentation-instructions.md`'s general "keep documentation internally consistent" discipline, not a new standalone process — but it is flagged here as a known, easy-to-repeat mistake given it just happened once already.

## Inconsistencies found and resolved during Round 1 review

1. **Broken/malformed code fence** in `07-security/tenant-isolation.md` (a stray `//` after a SQL code block) — fixed.
2. **Duplicate list numbering** in `11-adr/ADR-017-notifications.md` (two items both numbered "2.") — fixed.
3. **README.md cross-reference convention example** used a `../` relative path that would be incorrect if taken as a literal link from `docs/README.md` itself (it is illustrative example text within inline code, not a real link, but was clarified to remove ambiguity) — fixed.
4. **Roadmap Phase numbering** between the brief's narrative description (Phase 0–11) and the required directory structure (7 files) — flagged as an open assumption requiring confirmation. **Superseded**: resolved in Round 2, see above.

## Inconsistencies found and resolved during Round 2 review

1. **Overloaded "Phase" terminology** — the single largest finding of this round. "Phase N" was used inconsistently across the documentation set to mean either a Strategic Product Phase or a Technical Implementation Phase, with no explicit disambiguation. Resolved by introducing `ROADMAP-DECISION.md` as the numbering authority and correcting every affected cross-reference (see "Round 2: Roadmap ambiguity — resolved," above, for the full list of touched files).
2. **Redundant/awkward phrasing** introduced transiently by the automated correction pass (e.g., a line that ended up reading "(Strategic Phase 2, [Strategic Phase 2](...))") — caught by manual spot-review immediately after the automated pass and fixed in `06-modules/properties-prd.md` and `03-domain/marketplace.md`.
3. **`docs/README.md` and `12-claude/claude-code-guide.md`** did not point readers to the new numbering authority — both updated to reference `ROADMAP-DECISION.md` explicitly, given they are the two most likely entry points for a new reader or for Claude Code specifically.

No contradictory technology choices, no contradictory database decisions, no PRD referencing a nonexistent domain entity, and no ADR contradicting the architecture documents were found in either review round. Terminology usage was spot-checked against `00-overview/terminology.md` across all sections and found consistent.

## Recommended next implementation step

Begin **Sprint 0 — Engineering Foundation** (`13-roadmap/sprint-0.md`, part of Technical Implementation Phase 1): monorepo scaffold, Supabase environment provisioning, base CI/CD pipeline, and observability wiring — with **no customer-facing feature work** until that foundation is verified end-to-end. This is deliberately the lowest-risk, highest-leverage starting point: every later Strategic and Technical Phase depends on it, and it surfaces environment/tooling problems before any business logic is built on top of them.

The roadmap ambiguity that was the explicit precondition for starting Sprint 0 is now resolved (see Round 2). The remaining open items before Sprint 0 begins are the business decisions in "Open questions requiring human/business approval," above — none of which block Sprint 0 itself (they affect later sprints and Strategic Phases), but items 1–3 in particular are worth a decision sooner rather than later since they affect early product-facing choices (pricing display, branding, security review scheduling).

**This documentation set is ready for Sprint 0 to begin.**
