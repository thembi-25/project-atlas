# Technology Stack

This is the authoritative technology stack. No module PRD, ADR, or implementation may introduce a different technology for a covered concern without a new ADR superseding the relevant decision below.

## Application layer

| Concern | Technology | Notes |
|---|---|---|
| Language | TypeScript (strict mode) | See [ADR-003](../11-adr/ADR-003-typescript.md), [TypeScript Standards](../08-engineering/typescript-standards.md) |
| Web framework | Next.js (App Router) | Single deployable app; both UI and API routes. See [ADR-002](../11-adr/ADR-002-nextjs.md) |
| UI library | React 18 | Server Components by default; Client Components only where interactivity requires |
| Styling | Tailwind CSS | Utility-first, no separate CSS-in-JS runtime |
| Component primitives | shadcn/ui (on Radix UI) | Copied into the repo, not an opaque dependency — consistent with no-lock-in principle |
| Runtime validation | Zod | Shared schemas between client forms and server route handlers |
| Package manager / monorepo | pnpm workspaces + Turborepo | See [ADR-001](../11-adr/ADR-001-monorepo.md) |

## Data layer

| Concern | Technology | Notes |
|---|---|---|
| Primary database | PostgreSQL 15+ | See [ADR-004](../11-adr/ADR-004-postgresql.md) |
| Managed platform | Supabase | Postgres hosting, Auth, Storage, Realtime, migrations. See [ADR-005](../11-adr/ADR-005-supabase.md) |
| ORM / query layer | Drizzle ORM | Type-safe schema-as-code, SQL-first, first-class migration story. See [ADR-004](../11-adr/ADR-004-postgresql.md) |
| Tenant isolation | PostgreSQL Row Level Security | See [ADR-007](../11-adr/ADR-007-multi-tenancy.md) |
| Search | PostgreSQL full-text search (`tsvector`/GIN) | See [ADR-014](../11-adr/ADR-014-search.md) |
| Caching | Next.js data cache + Postgres; no Redis at launch | See [ADR-015](../11-adr/ADR-015-caching.md) |
| Background jobs | pg-boss (Postgres-backed queue) | See [ADR-016](../11-adr/ADR-016-background-jobs.md) |
| File storage | Supabase Storage (S3-compatible) | See [ADR-013](../11-adr/ADR-013-file-storage.md) |

## Identity & access

| Concern | Technology | Notes |
|---|---|---|
| Authentication | Supabase Auth (GoTrue) | Email/password at launch, OAuth (Google) as a fast-follow. See [ADR-006](../11-adr/ADR-006-authentication.md) |
| Authorization model | Custom RBAC on top of Supabase Auth | Organization Membership + Role + Permission tables. See [ADR-008](../11-adr/ADR-008-rbac.md) |

## Integrations

| Concern | Technology | Notes |
|---|---|---|
| Payments | Stripe | Card-present + online payments; PCI scope minimized via Stripe-hosted tokenization. See [ADR-018](../11-adr/ADR-018-payments.md) |
| Transactional email | Resend | |
| SMS | Twilio | |
| Accounting sync | QuickBooks Online API | See [Integrations PRD](../06-modules/integrations-prd.md) |

## Infrastructure & operations

| Concern | Technology | Notes |
|---|---|---|
| App hosting | Vercel | Next.js-native deployment, preview environments per PR |
| Background worker hosting | Small persistent Node process (Render or Fly.io) | pg-boss requires a long-running process, not serverless functions. See [ADR-016](../11-adr/ADR-016-background-jobs.md) |
| CI | GitHub Actions | Lint, type-check, test, migration check on every PR. See [CI/CD](../10-devops/ci-cd.md) |
| Error tracking | Sentry | Frontend + backend |
| Structured logs | Vercel log drains → Axiom | See [Logging](../10-devops/logging.md) |
| Uptime/alerting | Vercel + Supabase native monitoring, expanded per [ADR-021](../11-adr/ADR-021-observability.md) as needed | |

## Testing

| Concern | Technology | Notes |
|---|---|---|
| Unit/integration tests | Vitest | See [Unit Testing](../09-testing/unit-testing.md) |
| End-to-end tests | Playwright | See [End-to-End Testing](../09-testing/end-to-end-testing.md) |
| API tests | Vitest + Next.js route handler test harness | See [API Testing](../09-testing/api-testing.md) |

## Explicitly not used at launch (see [Architecture Principles](./architecture-principles.md))

Kubernetes, microservices, Kafka/message brokers beyond Postgres-backed queuing, Elasticsearch/Algolia, GraphQL, a service mesh, Redis (until justified), a separate NoSQL datastore.

## Mobile

The launch mobile experience is a responsive, installable web app (PWA) built from the same Next.js codebase, not a separate native codebase — see [ADR-024](../11-adr/ADR-024-mobile-strategy.md) and [Mobile PRD](../06-modules/mobile-prd.md).
