# Naming Conventions (Code)

This document covers code-level naming; database naming lives in [Database Naming Conventions](../04-database/naming-conventions.md) and the two are kept deliberately close (API/JSON fields mirror database column names — see [Resource Conventions](../05-api/resource-conventions.md)).

## Files and directories

- `kebab-case.ts` / `kebab-case.tsx` for files.
- Directories match the domain module names used throughout this documentation (`identity`, `crm`, `properties`, `jobs`, `financials`, `inventory`, `documents`, `notifications`, `analytics`) — see [Component Architecture](../02-architecture/component-architecture.md).
- Test files: `*.test.ts` colocated with the file under test, or `*.e2e.ts` under a top-level `e2e/` directory for Playwright specs — see [Testing Strategy](../09-testing/testing-strategy.md).

## React components

- `PascalCase.tsx`, one primary component per file, named identically to its default/named export.
- Server Components have no suffix; Client Components requiring `"use client"` are not suffix-marked in the filename either (the directive itself is the signal) — avoiding redundant naming noise.

## Functions

- `camelCase`, verb-first for actions (`createJob`, `dispatchJob`, `calculateInvoiceTotal`), noun-first for pure getters/selectors (`jobStatusLabel`).
- Route handlers: named `GET`, `POST`, `PATCH`, `DELETE` per Next.js Route Handler convention — not renamed.

## Business terminology alignment

Every function, type, and variable name representing a domain concept uses the exact term from [Terminology](../00-overview/terminology.md) — e.g., always `Membership`, never `OrgUser` or `UserOrgLink`; always `Dispatch`, never `Handoff`. A code review that finds a term diverging from Terminology is a legitimate blocking comment.

## Booleans

`is`/`has`/`can`/`should` prefixes (`isRequired`, `hasPortalAccess`, `canApprove`), matching the database convention in [Database Naming Conventions](../04-database/naming-conventions.md#columns).

## Constants and configuration

Environment variable names: `SCREAMING_SNAKE_CASE`, prefixed by concern (`DATABASE_URL`, `STRIPE_SECRET_KEY`, `TWILIO_AUTH_TOKEN`) — documented in `.env.example` per [Secrets Management](../07-security/secrets-management.md).

## Related documents

[TypeScript Standards](./typescript-standards.md) · [Database Naming Conventions](../04-database/naming-conventions.md) · [Terminology](../00-overview/terminology.md) · [Project Structure](./project-structure.md)
