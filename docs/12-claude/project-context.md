# Project Context

## What Project Atlas is

A multi-tenant vertical Industry Cloud Platform for field-service businesses, launching with plumbing, HVAC, and electrical trades. See [Vision](../00-overview/vision.md) and [Mission](../00-overview/mission.md) for the full framing — do not assume familiarity with any other project; this is a new product with its own domain model, terminology, and architecture.

## The one-paragraph summary

Atlas manages Organizations (tenants), their staff (Users via Membership/Role), their Customers and the Properties those Customers own/manage, the Assets installed at those Properties, and the Jobs performed on them — from scheduling through dispatch, execution, estimating, invoicing, and payment. Properties and Assets are permanent records independent of any one Job or Customer relationship, which is the structural basis of the product's long-term differentiation. See [Domain Overview](../03-domain/domain-overview.md).

## What Atlas is explicitly not

Not an AI product (AI is, at most, a draft-only assistive layer — see [ADR-020](../11-adr/ADR-020-ai-architecture.md)), not a microservices architecture, not built separately per trade, not a general field-service framework for every industry at launch. See [Product Principles](../00-overview/product-principles.md).

## Current implementation status

See [`DOCUMENTATION-CONSISTENCY-REPORT.md`](../DOCUMENTATION-CONSISTENCY-REPORT.md) for the authoritative statement of what exists vs. what's documented-but-not-yet-built. As of this documentation's authoring, **no production implementation exists** — this entire `docs/` tree was authored before any application code. Do not assume any module is implemented until you've verified it in the actual codebase.

## The stack, at a glance

Next.js (App Router) + TypeScript (strict) + React + Tailwind + shadcn/ui, modular monolith, PostgreSQL via Supabase (Auth, Storage), Drizzle ORM, REST API at `/api/v1/`. Full detail: [Technology Stack](../02-architecture/technology-stack.md).

## The non-negotiables, restated for quick reference

1. Tenant isolation is a database (RLS) guarantee, never solely an application-code promise.
2. Trade differences are configuration, never forked code paths.
3. Financial records (Invoices, Payments) are immutable once finalized.
4. Every state-changing action is audited, synchronously.
5. AI assists, drafts, and requires human confirmation — it never acts autonomously on financial, scheduling, or dispatch decisions.

## Where to find things

`docs/00-overview` (why), `docs/01-product` (what, for whom), `docs/02-architecture` (how, system-level), `docs/03-domain` (the business model), `docs/04-database` (the schema), `docs/05-api` (the contract), `docs/06-modules` (the detailed spec per feature area), `docs/07-security` through `docs/10-devops` (how it's built/run safely), `docs/11-adr` (why specific technical choices were made), `docs/13-roadmap` (what order things get built in). See [`docs/README.md`](../README.md) for the full index.
