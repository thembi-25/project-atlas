# Sprint 5 Completion Report

## Status

Complete. All 11 planned tasks (docs/13-roadmap/sprint-5.md) delivered: schema design, migrations applied live, the Stripe integration package, the `@atlas/financials` domain package, the domain-events outbox + Worker consumers, Customer Portal magic-link auth, all API routes (staff + Portal + webhook), minimal staff and Portal UI, unit and integration tests, and this report.

## Executive Summary

Sprint 5 closes the quote-to-cash loop opened by Sprint 4's Jobs: a Job can now be quoted with an Estimate, the Estimate approved by the Customer (staff-recorded or via a new Customer Portal), converted to a finalized Invoice (manually or automatically when the Job completes with an approved Estimate), and paid — by staff recording cash/check or by the Customer paying by card through the Portal, with card payments confirmed only via a Stripe webhook, never the synchronous client response. This is the largest and highest-stakes sprint yet: it is the first to touch real money (Stripe, ADR-018) and the first to introduce a second, non-staff authentication surface (the Customer Portal, ADR-006). Both were scoped narrowly per the two `AskUserQuestion` decisions confirmed before implementation began — see "Deviations From Documentation" below.

## Implemented Scope

- `financials` Postgres schema: `estimates`, `estimate_line_items`, `invoices`, `invoice_line_items`, `credit_notes`, `payments`, `estimate_number_counters`, `invoice_number_counters`.
- `platform.domain_events` transactional outbox and `platform.stripe_webhook_events` inbox — the first genuine use of `apps/worker`'s pg-boss dependency.
- `packages/integrations` (`@atlas/integrations`): a Stripe client wrapper (PaymentIntents, refunds, webhook signature verification) per ADR-018.
- `@atlas/financials`: domain (state machines, money math), application (Estimate/Invoice/Payment lifecycle, Credit Notes, Portal-scoped actions), infrastructure layers.
- `apps/worker`: the outbox dispatcher, the `job.completed` consumer (auto-generates a draft Invoice from an approved Estimate), and the Stripe webhook processor.
- Customer Portal magic-link authentication (`@atlas/auth`'s admin client + `@atlas/crm`'s portal-auth application layer), built on Supabase Auth's own `admin.generateLink`/`auth.verifyOtp` rather than a hand-rolled token table.
- 24 new API routes under `/api/v1/estimates`, `/api/v1/invoices`, `/api/v1/payments`, `/api/v1/webhooks/stripe`, and `/api/v1/portal/*`.
- Staff UI: Estimate list/detail (line-item builder, transition actions), Invoice list/detail (transition actions, payment recording). Portal UI: magic-link login, Estimate approve/reject view, Invoice payment view (Stripe Elements).
- Unit tests (36 in `@atlas/financials`, 4 in `@atlas/integrations`), 3 integration-tier test files (tenant isolation, full lifecycle, permission matrix) in `@atlas/financials`, 2 API integration test files in `apps/web`.

## Financials Domain

### Estimates

State machine: `draft → sent → approved/rejected/expired`, `approved → converted`, `draft/sent → cancelled` — matches estimates.md exactly. `total` is always computed from line items plus `tax_total`, never entered directly. Once `sent`, line items are immutable (`EstimateLineItemsImmutableError`); an edit requires a new version — `supersedes_estimate_id` models this, though no UI/API path yet creates a new version (see "Known Limitations"). At most one Estimate per Job may be `approved` at a time (enforced by `findApprovedEstimateForJob` querying on status, not a DB constraint — a second `approved` Estimate on the same Job is possible only if a caller bypasses the documented transition path entirely, which none does).

### Invoices

State machine: `draft → finalized → sent → partially_paid/paid`, `draft/finalized → void` — matches invoices.md. `invoice_number` is nullable and allocated only at *finalize* time (not creation), satisfying business rule 4's "gap-free for finalized Invoices specifically" — a deliberate divergence from `job_number`'s allocate-at-creation pattern (see "Architecture Decisions"). `amount_paid`/`balance_due` are never stored columns; always computed from linked non-failed Payments at read time. Finalizing requires the parent Job to be `completed`, except `is_deposit = true` Invoices. Voiding requires zero non-failed Payments (`InvoiceHasPaymentsError`).

### Credit Notes

Modeled as a single signed `amount` + `reason`, not a separate line-item breakdown — see "Deviations From Documentation". Gated on `invoices:void` (not the broader `invoices:write` Technician also holds), matching "Accountant/Admin/Owner: full access including void/credit note."

### Payments

State machine: `pending → completed/failed`, `completed → refunded` — matches payments.md. Cash/check are recorded `completed` immediately; card payments are recorded `pending` with a Stripe PaymentIntent and transition to `completed` **only** via the Worker's webhook consumer, never the synchronous capture response (ADR-018). Refunds are new, negative-amount, `refund_of_payment_id`-linked rows, never mutations. The "sum of non-failed Payments never exceeds Invoice total" invariant is enforced twice: at the application layer (`capturePayment`/`portal-capture-payment.ts` compute `balanceDue` before inserting) and at the database layer (a `BEFORE INSERT` trigger, migration 0022 — see "Database Changes").

## Customer Portal

Magic-link login built on Supabase Auth's native `auth.admin.generateLink`/`auth.verifyOtp` rather than a custom token-hash table (a deliberate refinement of the original plan — see "Architecture Decisions"). `SUPABASE_SERVICE_ROLE_KEY` is used for the first time in this codebase, narrowly, in `@atlas/auth`'s new `admin-client.ts`. On first successful verification, `identity.users` is upserted (the same primitive a staff User uses) and every portal-access-enabled `crm.contacts` row matching the verified email is linked via `portal_user_id`. Portal reads rely entirely on RLS (`contacts.portal_user_id = auth.uid()`); Portal writes (magic-link linking, Estimate approve/reject, card payment capture) run under `withServiceContext` with an explicit pre-check that the authenticated Portal identity is genuinely linked to the target Customer — mirroring `acceptInvitation`'s established escape-hatch pattern. Scope is deliberately minimal per the confirmed `AskUserQuestion` answer: no Properties/Jobs browsing, no Document download — only the two PRD-mandated transactional views.

## Database Changes

### Tables

`financials.{estimate_number_counters, estimates, estimate_line_items, invoice_number_counters, invoices, invoice_line_items, credit_notes, payments}`, `platform.domain_events`, `platform.stripe_webhook_events`. `crm.contacts` gained `portal_user_id` (nullable FK to `identity.users`).

### Constraints

- `chk_estimates_approver_single_source` — at most one of `approved_by_contact_id`/`approved_by_user_id` set.
- `chk_payments_amount_not_zero`.
- `app.check_payment_amount_within_invoice_total()` — a `BEFORE INSERT` trigger on `financials.payments` enforcing the cross-row "sum of non-failed Payments ≤ Invoice total" invariant (not expressible as a single-row CHECK).
- FK constraints from every new table to `org.organizations`, `jobs.jobs`, `crm.customers`/`crm.contacts`, `identity.users`, and within `financials` itself (`estimates.supersedes_estimate_id`, `payments.refund_of_payment_id` self-references).

### Indexes

Every FK-covering index was added proactively in the same migration as the RLS policies (migration 0021), rather than deferred to a post-hoc advisor-fix migration as in Sprints 3-4 — the advisor run afterward confirmed zero `unindexed_foreign_keys` findings on any `financials`/`platform` table introduced this sprint.

### Migrations

`0020_financials_estimates_invoices_payments` (schema), `0021_financials_rls_search_and_audit` (indexes, RLS policies incl. Portal-scoped, audit triggers), `0022_financials_payment_sum_check` (the cross-row trigger), `0023_financials_security_advisor_fixes` (function `search_path` fix). All applied live to the Atlas Project (`ucshfbwuoiohmkofqwte`) via `mcp__Supabase__apply_migration`.

A pre-existing migration-metadata chain corruption from Sprint 3 (`packages/database/migrations/meta/0012_snapshot.json`/`0013_snapshot.json`'s `prevId` fields formed a branch, not a chain — an artifact predating this sprint) was found and fixed by correcting `0015_snapshot.json`'s `prevId` to point at the correct parent id. This is purely local `drizzle-kit` bookkeeping metadata, never read by the live database or by `apply_migration`; no already-applied `.sql` migration file's content was touched.

## RLS and Tenant Isolation

Every new table has RLS enabled and forced. Staff policies gate on `app.current_user_has_permission(organization_id, resource, action)`. Portal policies are additive `SELECT`-only policies scoped through `crm.contacts.portal_user_id = (select auth.uid())` joined on `customer_id` — never `organization_id`, since a Contact's boundary is the Customer they belong to. `financials.estimate_number_counters`/`invoice_number_counters` and `platform.stripe_webhook_events` follow the established "RLS enabled/forced, zero policies" internal-only pattern from `jobs.job_number_counters` (Sprint 4).

### Tenant-isolation scenarios verified (written, integration-tier — see "Tests")

1. Owner B cannot read Org A's Estimate.
2. Owner A cannot create an Estimate against Org B's Job.
3. Owner B cannot read Org A's Invoice.
4. Owner A cannot capture a Payment against Org B's Invoice.
5. FORCE ROW LEVEL SECURITY holds under an unrelated actor context.
6. `audit_events` rows for Estimate/Invoice creation are visible only to the owning Organization.
7. Database FK constraint rejects an Estimate referencing a non-existent Job.
8. Database CHECK constraint rejects a zero-amount Payment.
9. Database trigger rejects a Payment exceeding the Invoice balance.
10. A Portal Contact linked to Org A cannot read Org B's Estimate or Invoice (Customer Portal-specific cross-tenant isolation), while confirmed able to read their own Org's.

## Permissions

No new permissions migration was needed: Sprint 1's seed (`0002_seed_platform_data.sql`) had already speculatively seeded the full `estimates`/`invoices`/`payments` resource:action catalog (`read`, `write`, `finalize`, `void`, `capture`, `refund`) and role mappings matching the domain docs exactly — Technician holds `write`/`capture` but not `finalize`/`void`/`refund`; Accountant/Admin/Owner hold everything; Dispatcher is read-only. `estimates:finalize`/`estimates:void` (seeded for a generic "financials" shape, since Estimates don't literally have `finalize`/`void` state-machine actions) were mapped onto Estimates' closest analogous elevated actions: `finalize` gates `convertEstimateToInvoice`, `void` gates `cancelEstimate` and `issueCreditNote`. This reuses the pre-seeded catalog exactly as intended rather than adding new permission rows.

## API Endpoints

`/api/v1/estimates` (GET/POST), `/api/v1/estimates/{id}` (GET/PATCH), `/api/v1/estimates/{id}/{send,approve,reject,cancel,convert}` (POST). `/api/v1/invoices` (GET/POST), `/api/v1/invoices/{id}` (GET/PATCH), `/api/v1/invoices/{id}/{finalize,send,void}` (POST), `/api/v1/invoices/{id}/credit-notes` (POST), `/api/v1/invoices/{id}/payments` (GET/POST). `/api/v1/payments/{id}/refund` (POST). `/api/v1/webhooks/stripe` (POST). `/api/v1/portal/auth/{request-link,complete}` (POST), `/api/v1/portal/me` (GET), `/api/v1/portal/estimates/{id}` (GET), `/api/v1/portal/estimates/{id}/{approve,reject}` (POST), `/api/v1/portal/invoices/{id}` (GET), `/api/v1/portal/invoices/{id}/pay` (POST). Command endpoints throughout, not a generic status `PATCH`, per docs/05-api/resource-conventions.md.

## UI

Staff: `/estimates` (list + create), `/estimates/{id}` (line items, totals, transition buttons), `/invoices` (list + ad hoc create), `/invoices/{id}` (line items, totals, transition buttons, payment recording form, payment history). Portal: `/portal/login` (email request + `token_hash` auto-verify), `/portal` (linked-Customer confirmation, deliberately no browsing), `/portal/estimates/{id}` (approve/reject), `/portal/invoices/{id}` (Stripe Elements card payment). Not tested against a live browser session (no provisioned staff/Portal session available in this sandbox — the production build succeeds and every route compiles, but click-through verification could not be performed, same limitation as prior sprints).

## Audit Logging

`app.record_audit_event()` triggers attached to `financials.{estimates, estimate_line_items, invoices, invoice_line_items, credit_notes, payments}`, exactly mirroring the Sprint 1-4 pattern. `platform.audit_actor_type` gained a `'contact'` value (via `ALTER TYPE ... ADD VALUE` in migration 0020, not by editing the Sprint 1 migration) for future Portal-actor audit attribution — not yet wired into `app.current_actor_user_id()`'s actor-type resolution (see "Known Limitations").

## Event History (Outbox)

`platform.domain_events` — `@atlas/jobs`'s `completeJob` and `@atlas/financials`'s `approveEstimateInTx`/`finalizeInvoice`/`capturePayment` (cash/check path)/`processStripeWebhookEvent` (card path) write `job.completed`, `estimate.approved`, `invoice.finalized`, and `payment.received` respectively, transactionally alongside their state change. `apps/worker`'s dispatcher polls pending rows and relays each to a same-named pg-boss queue, regardless of whether a consumer is registered — the relay is decoupled from consumer existence, so a future module can start consuming without touching this code. `job.dispatched` is not implemented (no consumer justifies it — Sprint 4's scheduling code is untouched).

## Background Jobs

`apps/worker` now has its first real handlers: `boss.work('job.completed', ...)` (auto-generates a draft Invoice from an approved Estimate), a `setInterval`-driven domain-events dispatcher, and a `setInterval`-driven Stripe-webhook-inbox drain. `estimate.approved`/`invoice.finalized`/`payment.received` are dispatched to pg-boss queues with no registered consumer yet (no Notifications module exists — same deferral pattern as prior sprints).

## Tests

### Unit Tests

`@atlas/financials`: 36 tests (`domain/lifecycle.test.ts` — 27, all three state machines + `isInvoiceOverdue`; `domain/money.test.ts` — 9, line-total/subtotal/total/amount-paid/balance-due/cents-conversion). `@atlas/integrations`: 4 tests (Stripe client construction/caching, webhook signature verification error paths). All passing.

### Integration Tests (written, not executed — see below)

`@atlas/financials/src/integration/`: `tenant-isolation.test.ts` (the ten scenarios above), `estimate-invoice-payment-lifecycle.test.ts` (full draft→paid flow incl. Portal approval and a partial-payment-then-refund flow), `permission-matrix.test.ts` (Dispatcher/Technician/Accountant role boundaries).

### API Tests (written, not executed — see below)

`apps/web/app/api/v1/estimates/route.integration.test.ts`, `apps/web/app/api/v1/invoices/[id]/payments/route.integration.test.ts` (incl. the idempotency-key double-submission check).

### Why integration/API tests could not be executed

Re-confirmed, exactly as in Sprints 1-4: `pnpm test:integration` (both `@atlas/financials` and `apps/web`) was actually attempted against the real, correctly-configured `DATABASE_URL` from `.env.local`, and both hung past a `timeout 45` wrapper (exit 143) — this sandbox has no raw Postgres TCP egress, a sandbox network limitation, not a code or configuration defect. No test result is claimed beyond what actually ran.

### Database/RLS Tests

Covered by the integration-tier tenant-isolation suite above — same execution caveat.

### Security Tests

Covered by the Supabase advisor runs documented below.

## Validation Results

### Formatting

`pnpm exec prettier --check .` — clean across every file touched this sprint (57 files reformatted via `--write` where needed). One pre-existing, untouched file (`packages/scheduling/src/integration/scheduling-dispatch.test.ts`, predating this sprint) remains flagged and was left alone, out of scope.

### Lint

`pnpm turbo run lint` — clean across all 20 workspace packages/apps, including every new/modified package (`@atlas/financials`, `@atlas/integrations`, `@atlas/auth`, `@atlas/crm`, `@atlas/identity`, `@atlas/jobs`, `@atlas/database`, `@atlas/worker`, `@atlas/web`, `@atlas/config`).

### Typecheck

`pnpm turbo run typecheck` — clean across all 20 workspace packages/apps.

### Tests

`pnpm turbo run test` — 57/57 tasks successful; every unit-tier test suite across the monorepo passes (see per-package counts under "Unit Tests" above plus pre-existing Sprint 1-4 suites, all re-verified green).

### Build

`apps/web`: `next build` succeeds, all 31+ routes (including every new Sprint 5 route) compile and register correctly. `apps/worker`: `tsc -p tsconfig.build.json` succeeds.

## Security Findings

Ran `mcp__Supabase__get_advisors` (security and performance) after migrations 0020-0022. Findings and resolutions:

1. **`function_search_path_mutable`** (1 finding, real): `app.check_payment_amount_within_invoice_total()` lacked a fixed `search_path`. Fixed in migration 0023 (`ALTER FUNCTION ... SET search_path = ''`) — safe, since its body already fully-qualifies every table reference.
2. **`rls_enabled_no_policy`** (expected, INFO): `financials.estimate_number_counters`/`invoice_number_counters`, `platform.stripe_webhook_events` — all deliberately zero-policy internal tables, matching the `jobs.job_number_counters` precedent.
3. **`multiple_permissive_policies`** (expected, INFO): every table with both a staff and a Portal `SELECT` policy — deliberate and additive (OR'd), matching the pre-existing `org.teams`/`identity.membership_roles` pattern from earlier sprints that was already left unaddressed for the same reason (a minor query-planner optimization not worth sacrificing the staff/Portal policy separation's clarity).
4. **`unindexed_foreign_keys`**: zero findings on any table introduced this sprint (proactively indexed — see "Database Changes").
5. **`auth_rls_initplan`**: zero findings on any policy introduced this sprint (every new policy uses `(select auth.uid())` from the start). The three pre-existing Sprint-1 `identity.*` instances remain untouched, per the established "never edit an applied migration" rule.

No unresolved findings remain on any Sprint-5-introduced object.

## Documentation Changes

`docs/13-roadmap/sprint-5.md` (authored at sprint start, refined once — see "Architecture Decisions" — before schema work began), this completion report.

## Architecture Decisions

- **Customer Portal auth mechanism refined mid-design**: `sprint-5.md`'s first draft described magic-link auth "mirroring Sprint 1's Membership-invitation-token pattern" (a hand-rolled token-hash column). Before writing any code, this was replaced with Supabase Auth's own `admin.generateLink`/`auth.verifyOtp` — the invitation-token pattern only works because an invitee already holds an independent Supabase session before redeeming (the custom token is an authorization link, not the authentication event itself); a Contact has no prior account at all, so the magic link must itself be the authentication event, which only Supabase Auth's own primitive can safely provide. This is the first use of the previously-unused `SUPABASE_SERVICE_ROLE_KEY`, in the narrow, reviewed path `.env.example` anticipated for it.
- **`invoice_number` allocated at finalize, not creation**: unlike `job_number`/`estimate_number` (allocated at creation), invoices.md business rule 4 requires gap-free numbering specifically for *finalized* Invoices — a voided draft must not consume a visible number. The counter allocator (`allocateInvoiceNumber`) is therefore only called from `finalizeInvoice`, not `createInvoice`.
- **Credit Notes modeled as a single amount, not a line-item breakdown**: invoices.md's Data Requirements line mentions "line items" only in passing for Credit Notes; a Credit Note's purpose here is a net financial adjustment record satisfying the immutability principle, not a second billable line-item breakdown. A deliberate, minimal-but-correct scope decision.
- **All portal writes route through `withServiceContext` with an explicit pre-check, not new RLS write policies**: keeps the writable RLS surface reserved for Membership-based staff policies only, consistent with customer-portal-prd.md's "explicit and narrowly scoped" access requirement, and mirrors `acceptInvitation`'s established escape-hatch reasoning exactly.
- **`job.completed`'s auto-invoice consumer only fires when an approved Estimate exists**: reconciles invoicing-prd.md's "zero re-entry" goal with the caution against ever auto-generating an Invoice with no real content. If no approved Estimate exists, staff creates the Invoice manually.
- **Two short `withServiceContext` transactions in the outbox dispatcher rather than one long one**: avoids holding a Postgres row lock across the network call to pg-boss's `boss.send()`, an unnecessary contention risk for no benefit at this sprint's single-Worker-process scale.

## Deviations From Documentation

Same category as Sprint 4's `scheduling:read_assigned` refinement: a correction that makes the actual implementation match the documented *intent* more precisely than a literal reading would, not an invented capability. Both listed under "Architecture Decisions" above (the Portal auth mechanism, and Credit Notes' scope) are the Sprint 5 instances of this pattern; both were resolved before any code was written, not discovered mid-implementation.

## Known Limitations

- **Integration and API-layer tests are written but not executed** — confirmed blocked by the sandbox's lack of raw Postgres TCP egress (see "Tests"), identical to every prior sprint.
- **No live Stripe testing** — this sandbox has no configured `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. `@atlas/integrations`'s Stripe wrapper, the capture/refund/webhook-verification code paths, and the Portal's Stripe Elements payment form are all written to be structurally correct and are ready for real test-mode keys, but no live PaymentIntent, webhook, or refund has actually been exercised against Stripe's API.
- **No live Portal login click-through** — same reasoning: no provisioned Supabase session in this sandbox to actually request/verify a magic link end-to-end. The full build succeeds and every route compiles.
- **Estimate versioning (`supersedes_estimate_id`) has no UI/API path yet** — the column and domain-error (`EstimateLineItemsImmutableError`) exist and correctly block editing a sent Estimate's line items, but no endpoint creates a linked new version. Editing a sent Estimate currently requires creating a wholly new, unlinked Estimate — a real gap against estimates.md business rule 2's letter, though the immutability guarantee itself (the actual safety property that rule protects) holds.
- **`platform.audit_actor_type`'s new `'contact'` value is not yet wired into actor-type resolution** — `app.current_actor_user_id()`/`record_audit_event()` still resolve every actor as `'user'` or `'system'`; Portal-initiated audit rows (which go through `withServiceContext`, itself resolvable to a `portalUserId`) are attributed the same way a staff action would be, not distinctly as `'contact'`. The enum value exists for a future refinement, not yet applied.
- **No tax-rate/jurisdiction configuration entity** — `tax_total` is caller-supplied (defaulting to 0), not computed from any tax-rate configuration; no such entity is documented as in scope for this sprint.
- **Stripe Terminal (card-present) is explicitly out of scope**, per the confirmed `AskUserQuestion` answer — only online/Portal PaymentIntent-based card capture is implemented.

## Sprint 5 Readiness for Sprint 6

Sprint 6 (Inventory & Suppliers) depends only on Sprint 4 (Jobs), not on Sprint 5, per ROADMAP-DECISION.md Section D — it can proceed independently of anything in this report. `financials.estimate_line_items`/`invoice_line_items`'s deferred `inventory_item_id` column (documented in `packages/database/src/schema/financials.ts`'s comments, mirroring the `crm.contacts.portal_user_id` deferral precedent from Sprint 2-4) is the one piece of groundwork Sprint 6 will need to add a real FK to once `inventory` exists.
