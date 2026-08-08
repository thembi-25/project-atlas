# Local Development

## Prerequisites

Node.js (current LTS), pnpm, Docker (for local Supabase), the Supabase CLI.

## Setup

1. Clone the monorepo; `pnpm install` at the root (installs all workspace packages — see [Project Structure](../08-engineering/project-structure.md)).
2. Copy `.env.example` to `.env.local`; fill in values from the team's shared secret store (see [Secrets Management](../07-security/secrets-management.md)) — never real Production credentials.
3. `supabase start` to run a local Postgres + Auth + Storage stack in Docker, matching the Production topology described in [Deployment Architecture](../02-architecture/deployment-architecture.md) as closely as practical.
4. `pnpm db:migrate` to apply the current schema (Drizzle Kit) plus seed data (see [Seed Data](../04-database/seed-data.md)).
5. `pnpm dev` runs the Next.js app (`apps/web`) and, in a separate process, the Worker (`apps/worker`) — both needed for full local functionality (e.g., notification sending, scheduled Analytics refresh).

## Local-only seed/fixture data

In addition to the platform seed data described in [Seed Data](../04-database/seed-data.md), local development seeds sample Organizations/Customers/Properties/Jobs via a dedicated `pnpm db:seed:dev` script — clearly separated from platform seed migrations, and never runnable against Staging/Production (the script checks and refuses to run against a non-local database URL).

## Third-party services in local development

- Stripe: test-mode keys, using Stripe CLI for local webhook forwarding.
- Twilio/Resend: test-mode/sandbox credentials; local development defaults to logging notification content to the console rather than actually sending, to avoid accidental real SMS/email sends during development.

## Running tests locally

`pnpm test` (unit + integration, against the local Supabase instance), `pnpm test:e2e` (Playwright, against a locally running `pnpm dev` instance) — see [Testing Strategy](../09-testing/testing-strategy.md).

## Common tasks

| Task | Command |
|---|---|
| Generate a new migration from schema changes | `pnpm db:generate` |
| Reset local database to a clean migrated + seeded state | `pnpm db:reset` |
| Run lint/type-check | `pnpm lint` / `pnpm typecheck` |

## Related documents

[Project Structure](../08-engineering/project-structure.md) · [Environment Management](./environment-management.md) · [Seed Data](../04-database/seed-data.md) · [Secrets Management](../07-security/secrets-management.md)
