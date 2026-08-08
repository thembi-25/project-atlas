# TypeScript Standards

## Strict mode, non-negotiable

`tsconfig.json` uses `"strict": true` (and its full implied set: `strictNullChecks`, `noImplicitAny`, etc.) across every package in the monorepo — see [Non-Functional Requirements](../01-product/non-functional-requirements.md), NFR-19.

## Type sources of truth

- **Database types**: generated directly from the Drizzle ORM schema — never hand-written duplicates that can drift from the actual schema. See [Database Architecture](../04-database/database-architecture.md).
- **API request/response types**: derived from Zod schemas (`z.infer<typeof schema>`) shared between client and server — one definition, not a hand-maintained interface plus a separate validator that can disagree.
- **Domain types** (e.g., a `JobStatus` union): defined once in the owning domain module (`packages/modules/jobs`) and imported everywhere else that needs them — never redefined locally in a consuming module.

## No `any`, minimal `unknown` escape hatches

See [Coding Standards](./coding-standards.md). Where a value's shape is genuinely unknown at compile time (e.g., a third-party webhook payload before validation), it is typed `unknown` and narrowed via a Zod parse before use — never cast directly to a concrete type without validation.

## Discriminated unions for state machines

Every domain entity with a state machine (see [Jobs](../03-domain/jobs.md), [Estimates](../03-domain/estimates.md), [Invoices](../03-domain/invoices.md), [Payments](../03-domain/payments.md)) is modeled in TypeScript as a discriminated union keyed on `status`, so the compiler enforces that code handling a `draft` Estimate can't accidentally access fields that only exist once `approved` — not just a flat interface with all fields optional.

```typescript
type Estimate =
  | { status: 'draft'; /* ... */ }
  | { status: 'sent'; sentAt: string; /* ... */ }
  | { status: 'approved'; sentAt: string; approvedAt: string; approvedBy: string; /* ... */ }
  // ...
```

## Module boundaries are type-enforced

Each domain module (see [Component Architecture](../02-architecture/component-architecture.md)) exposes a public TypeScript interface (its `index.ts` barrel export) that is the *only* thing other modules import from it — internal implementation files are not importable across module boundaries, enforced by both file-structure convention and the import-boundary lint rule referenced in [Coding Standards](./coding-standards.md).

## Naming conventions

- Types/interfaces: `PascalCase` (`Job`, `JobStatus`, `CreateJobInput`).
- Functions/variables: `camelCase`.
- Constants/enums: `SCREAMING_SNAKE_CASE` for true constants, `PascalCase` for `as const` unions used as pseudo-enums.
- File names: `kebab-case.ts`, matching the primary export where reasonable.

## Related documents

[Coding Standards](./coding-standards.md) · [Naming Conventions](./naming-conventions.md) · [Project Structure](./project-structure.md) · [ADR-003: TypeScript](../11-adr/ADR-003-typescript.md)
