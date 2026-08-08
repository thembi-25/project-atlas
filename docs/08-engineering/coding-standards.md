# Coding Standards

## Language and formatting

TypeScript strict mode everywhere (see [TypeScript Standards](./typescript-standards.md)); ESLint + Prettier enforced in CI and via pre-commit hook — no unformatted or lint-failing code merges. See [ADR-003](../11-adr/ADR-003-typescript.md).

## Layered architecture is enforced, not aspirational

Every PR touching business logic is checked against [Architecture Principles](../02-architecture/architecture-principles.md): Presentation components contain no business rules; Application (route handlers/server actions) orchestrates; Domain logic is framework-free; Infrastructure is isolated. A lint rule (import boundary enforcement, e.g., `eslint-plugin-boundaries`) blocks a Presentation-layer file from importing directly from an Infrastructure-layer module, catching layering violations mechanically rather than relying solely on review vigilance.

## No premature abstraction

Consistent with the project's engineering philosophy: three similar lines of code are preferred over a premature shared abstraction; a helper/utility is extracted only once a genuine third use case appears, not speculatively for a second one. No feature flags or backwards-compatibility shims are introduced for internal refactors — the code is just changed.

## Error handling

- Errors are handled at the layer that has enough context to do something useful with them (retry, translate to a user-facing message, log with context) — not swallowed silently and not re-thrown generically without added context.
- No `try/catch` blocks that catch and ignore an error without at least logging it.
- Validation errors (see [Request Validation](../05-api/request-validation.md)) are distinct from unexpected errors (`500`s) in both handling and Sentry classification.

## No `any`

`any` is disallowed by lint rule; the rare justified exception (e.g., a third-party library with poor types) requires an inline comment explaining why and a `// eslint-disable-next-line` scoped to the specific line, never a blanket file-level suppression.

## No magic strings/numbers

Enumerable values (statuses, Roles, event types) use TypeScript enums or `as const` string-literal unions shared between the database enum type and application code (generated from the Drizzle schema, not hand-duplicated) — see [Naming Conventions](../04-database/naming-conventions.md).

## Security-by-default

- No raw SQL string concatenation (see [API Security](../07-security/api-security.md)).
- No `dangerouslySetInnerHTML` without an explicit, reviewed exception.
- No secret ever logged or committed (see [Secrets Management](../07-security/secrets-management.md)).

## Consistency with documentation

Code must match the domain model, database schema, and API conventions documented in [`03-domain/`](../03-domain/), [`04-database/`](../04-database/), and [`05-api/`](../05-api/) — a discrepancy is treated as a bug in either the code or the documentation, and is resolved by updating whichever is wrong, never left inconsistent. See [Documentation Instructions](../12-claude/documentation-instructions.md).

## Related documents

[TypeScript Standards](./typescript-standards.md) · [Project Structure](./project-structure.md) · [Code Review](./code-review.md) · [Architecture Principles](../02-architecture/architecture-principles.md)
