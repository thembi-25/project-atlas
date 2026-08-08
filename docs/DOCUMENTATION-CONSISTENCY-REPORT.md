# Documentation Consistency Report

This report is the output of the final review pass over the Project Atlas documentation set. It records what was created, the major decisions embedded in it, what was found and fixed during review, what remains genuinely open, and what a human should decide before implementation begins.

## Documents created

**196 Markdown files** across 15 sections, matching the directory structure specified for this documentation effort exactly:

| Section | Files | Section | Files |
|---|---|---|---|
| `docs/README.md` | 1 | `07-security/` | 9 |
| `00-overview/` | 10 | `08-engineering/` | 9 |
| `01-product/` | 8 | `09-testing/` | 8 |
| `02-architecture/` | 12 | `10-devops/` | 9 |
| `03-domain/` | 28 | `11-adr/` | 26 |
| `04-database/` | 13 | `12-claude/` | 12 |
| `05-api/` | 13 | `13-roadmap/` | 12 |
| `06-modules/` | 26 | | |

Every module PRD in `06-modules/` contains all 20 required sections (Purpose through Future Extensions), verified programmatically. Every ADR in `11-adr/` contains all 10 required template sections (Status through Related Decisions), verified programmatically. A full relative-link scan found zero genuinely broken links (2,567 relative links checked).

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

## Major assumptions made

These were not specified in the original brief and were resolved with a documented, reasoned default so the documentation could be internally consistent. Each is flagged below as either safe-to-proceed-on or requiring confirmation.

1. **ORM choice (Drizzle over Prisma)** — reasoned default in ADR-004; low-risk, easily revisited before significant code is written.
2. **Roadmap Phase numbering reconciliation** — the brief's PHASE 14 section describes a more granular 12-step breakdown (Phase 0–11) while the required directory structure specifies exactly 7 roadmap phase files (`phase-1-foundation.md` through `phase-7-industry-network.md`). These were reconciled by mapping the 7 required files onto the 6 long-term platform pillars (plus a Foundation prerequisite), with the granular breakdown folded into Phase 1 (Foundation + Identity) and Phase 2 (Core Operations, bundling CRM/Properties/Jobs/Financials/Inventory as one launch milestone). This mapping is made explicit in `13-roadmap/implementation-roadmap.md`. **This is an interpretation, not a specification — confirm it matches actual business sequencing intent.**
3. **Pricing tier structure** — a directional 3-tier (Starter/Growth/Pro) seat-based model is documented in `01-product/pricing-strategy.md` as a framework, explicitly not as final pricing. **Requires business decision.**
4. **Manufacturers as platform-shared (cross-tenant) reference data** — the one deliberate exception to strict per-Organization data ownership, justified in `03-domain/manufacturers.md` on the grounds that manufacturer identity is a real-world fact, not tenant-specific data.
5. **7-year financial / 3-year operational audit retention** — reasoned default in `04-database/audit-logging.md` based on typical U.S. small-business record-keeping norms, not a confirmed legal requirement. **Requires compliance/legal confirmation.**
6. **U.S.-only launch scope** (tax, currency, compliance) — consistent with the target customer segment in `00-overview/target-customers.md`; treated as a firm launch-scope boundary, not merely a suggestion.

## Open questions requiring human/business approval

Tracked in full in `13-roadmap/implementation-backlog.md`; the highest-priority ones:

1. Exact pricing tier price points and whether a free tier exists.
2. Production domain name and branding assets (referenced as a placeholder in `05-api/api-overview.md`).
3. External penetration test scheduling and budget (`09-testing/security-testing.md`).
4. Phase 7's data-rights/consent legal framework — explicitly gated as a prerequisite to any Industry Data Network implementation work, not something engineering can resolve unilaterally (`13-roadmap/phase-7-industry-network.md`).
5. Whether Roadmap Phases 3–6 (Property Intelligence, Marketplace, Manufacturers, Financial Services) should be resequenced relative to each other based on actual partnership/business development progress once Phase 2 ships — the documented default order follows the stated business rationale but is not a rigid commitment.
6. Confirmation of the Roadmap Phase numbering reconciliation described in Major Assumptions, item 2.

## Known risks (see `07-security/threat-model.md` for the full model)

1. **RLS policy correctness is the platform's single highest-stakes ongoing engineering risk** — mitigated architecturally by mandatory cross-tenant isolation tests on every tenant-owned table, but this requires sustained engineering discipline, not a one-time fix.
2. **Trade-agnostic configuration model complexity** — as more trades and Organization-specific customization accumulate, the configuration-over-code-branching discipline (ADR-009) requires active maintenance to avoid quietly degrading into hard-coded exceptions.
3. **Vendor concentration** — Supabase (database/auth/storage), Vercel (hosting), and Stripe (payments) are each load-bearing dependencies with no redundant fallback at launch scale; accepted per the anti-overengineering principle but worth revisiting as the business scales.
4. **Documentation-implementation drift** — this entire set was authored before any code exists; `08-engineering/documentation-standards.md` and `12-claude/documentation-instructions.md` establish the discipline to keep them in sync, but that discipline has not yet been tested against real implementation pressure.

## Inconsistencies found and resolved during this review

1. **Broken/malformed code fence** in `07-security/tenant-isolation.md` (a stray `//` after a SQL code block) — fixed.
2. **Duplicate list numbering** in `11-adr/ADR-017-notifications.md` (two items both numbered "2.") — fixed.
3. **README.md cross-reference convention example** used a `../` relative path that would be incorrect if taken as a literal link from `docs/README.md` itself (it is illustrative example text within inline code, not a real link, but was clarified to remove ambiguity) — fixed.
4. **Roadmap Phase numbering** between the brief's narrative description (Phase 0–11) and the required directory structure (7 files) — resolved via the explicit mapping documented in `13-roadmap/implementation-roadmap.md` (see Major Assumptions, item 2).

No contradictory technology choices, no contradictory database decisions, no PRD referencing a nonexistent domain entity, and no ADR contradicting the architecture documents were found in this review pass. Terminology usage was spot-checked against `00-overview/terminology.md` across all sections and found consistent.

## Recommended next implementation step

Begin **Sprint 0** (`13-roadmap/sprint-0.md`): monorepo scaffold, Supabase environment provisioning, base CI/CD pipeline, and observability wiring — with **no customer-facing feature work** until that foundation is verified end-to-end. This is deliberately the lowest-risk, highest-leverage starting point: every other phase depends on it, and it surfaces environment/tooling problems before any business logic is built on top of them.

Before Sprint 0 begins, a human should resolve or explicitly accept the open questions above, particularly item 2 (Roadmap Phase numbering reconciliation) and item 5 (Phase 3–6 sequencing), since these affect how the team plans work beyond the first two sprints.
