# Coding Instructions

## Before writing code

Confirm you've read: the module's PRD ([`06-modules/`](../06-modules/)), the relevant domain doc(s) ([`03-domain/`](../03-domain/)), and any governing ADRs ([`11-adr/`](../11-adr/)). See [Claude Code Guide](./claude-code-guide.md).

## Follow the layered architecture

Presentation (React components) → Application (route handlers/use cases) → Domain (business logic) → Infrastructure (database/external APIs), per [Architecture Principles](../02-architecture/architecture-principles.md). Place new code in the correct layer of the correct module directory per [Project Structure](../08-engineering/project-structure.md) — do not create a new top-level pattern without checking if an existing one already fits.

## TypeScript discipline

Strict mode, no `any` without a justified, commented exception, types derived from the Drizzle schema and Zod validators rather than hand-duplicated — see [TypeScript Standards](../08-engineering/typescript-standards.md).

## Naming

Use the exact business terms from [Terminology](../00-overview/terminology.md) and the conventions in [Naming Conventions (Code)](../08-engineering/naming-conventions.md)/[Database Naming Conventions](../04-database/naming-conventions.md) — do not invent synonyms for existing domain concepts.

## State machines

Implement entity state machines as discriminated unions (see [TypeScript Standards](../08-engineering/typescript-standards.md)) matching exactly the diagram in the entity's domain document — every valid and invalid transition must be handled explicitly, not inferred.

## Incremental implementation

Implement in reviewable steps: data layer (schema + migration + RLS) → domain logic → application use cases → API routes → UI — each step should be independently correct and, where practical, independently committable, per [Git Workflow](../08-engineering/git-workflow.md).

## Simplicity

Three similar lines beat a premature abstraction. Don't add configuration/flexibility beyond what the current PRD's documented scope requires — see [Coding Standards](../08-engineering/coding-standards.md).

## After writing code

1. Run lint, type-check, and the relevant test suites locally before considering the task done.
2. Verify the change against the module's [Acceptance Criteria](../01-product/acceptance-criteria.md) and its own PRD's section 18.
3. Confirm no unrelated files changed.

## Related documents

[Coding Standards](../08-engineering/coding-standards.md) · [TypeScript Standards](../08-engineering/typescript-standards.md) · [Project Structure](../08-engineering/project-structure.md) · [Implementation Rules](./implementation-rules.md)
