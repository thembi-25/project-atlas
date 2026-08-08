# Feature Development Workflow

This is the step-by-step process for implementing a new feature or module capability, operationalizing [Claude Code Guide](./claude-code-guide.md) and PHASE 10 of the original project brief.

## 1. Read relevant PRD

Find the feature in its module PRD under [`06-modules/`](../06-modules/). Confirm the feature is actually documented there — if not, stop and clarify scope before writing code.

## 2. Read relevant domain model

Read the domain document(s) in [`03-domain/`](../03-domain/) for every entity the feature touches — attributes, relationships, business rules, state machines.

## 3. Read relevant ADRs

Check [`11-adr/`](../11-adr/) for any decision governing the area (data storage pattern, integration approach, architectural boundary). Follow the established pattern; don't introduce a new one without a new ADR.

## 4. Inspect existing implementation

Look at what's already built for this module and adjacent modules — match existing patterns (see [Project Structure](../08-engineering/project-structure.md), [Coding Standards](../08-engineering/coding-standards.md)) rather than introducing a stylistically different approach for no reason.

## 5. Explain planned changes

Before implementing, state: which files/modules will change, what new tables/endpoints (if any) are needed, and how this maps to the PRD's functional requirements. This is where a scope mismatch or missing documentation gets caught cheaply, before code is written.

## 6. Implement incrementally

Data layer (schema + RLS + migration) → Domain logic → Application use cases → API routes → UI, per [Coding Instructions](./coding-instructions.md). Each step should be reviewable on its own.

## 7. Write/update tests

Per [Testing Instructions](./testing-instructions.md) — unit, integration, API, and (rarely, for genuinely new golden paths) E2E, matching the mandatory coverage table there.

## 8. Run validation

Lint, type-check, full relevant test suite, and a manual check against the PRD's Acceptance Criteria (section 18).

## 9. Report files changed

List every file touched, grouped by layer/module, so a reviewer can quickly confirm scope matches what was described in step 5.

## 10. Report tests executed

State which test suites ran and their outcome — not just "tests pass" but which specific suites, so a reviewer knows what was and wasn't covered.

## 11. Identify remaining risks

State anything left uncertain: an edge case not fully covered, a performance characteristic not yet verified at scale, a follow-up documentation update still needed. Do not present a feature as fully done if genuine open questions remain — surface them per [Definition of Done](./definition-of-done.md).

## Related documents

[Claude Code Guide](./claude-code-guide.md) · [Bug Fixing Workflow](./bug-fixing-workflow.md) · [Definition of Done](./definition-of-done.md)
