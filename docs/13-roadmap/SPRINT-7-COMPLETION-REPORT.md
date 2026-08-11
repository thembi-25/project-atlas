# Sprint 7 Completion Report

## Status

Complete.

## Executive Summary

Sprint 7 delivers **Core Operations MVP Hardening** — the final sprint `ROADMAP-DECISION.md` Section D requires before Strategic Phase 1 (MVP) can be considered code-complete. It closes out Notifications, the one module every prior sprint deliberately deferred despite `platform.domain_events` recording the full launch-scope event catalog since Sprint 5; adds a basic Analytics dashboard over four materialized views; adds synchronous CSV Reporting; and adds a real QuickBooks Online OAuth connect/disconnect flow with an event-driven sync consumer. It also carries a retroactive Security Testing checklist pass and a User Journeys 1–4 trace against the accumulated Sprints 1–7 system, both reported honestly against what this sandbox can and cannot execute live.

Two scope decisions were confirmed with the user via `AskUserQuestion` before implementation began, both the recommended option — see `docs/13-roadmap/sprint-7.md`, "Scope decisions," for the full record:
- Both Resend (email) and Twilio (SMS) get full, structurally-correct typed clients and real Worker consumers — untestable live in this sandbox (no `RESEND_API_KEY`/`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`), mirroring exactly how Sprint 5 built Stripe.
- Reporting is scoped to synchronous CSV export only (no `export_jobs` async queue, no PDF generation); QuickBooks gets a real OAuth flow and `integration_connections`/`sync_records` data model, structurally correct and untestable without a registered app, the same Stripe-precedent treatment.

## Implemented Scope

- `notifications` Postgres schema (`notifications`, `notification_preferences`) and `integrations` Postgres schema (`integration_connections`, `sync_records`) — RLS enabled/forced on all four tables (migrations 0027/0028).
- `analytics` Postgres schema: four materialized views (`mv_revenue_by_period`, `mv_job_volume_by_type`, `mv_technician_utilization`, `mv_invoice_aging`) plus a `view_refresh_log` staleness-tracking table (migrations 0029/0030).
- `packages/integrations/{resend,twilio,quickbooks}` — typed provider clients (send/webhook-verify for Resend/Twilio; OAuth + Invoice/Payment push for QuickBooks) alongside Sprint 5's `stripe`.
- `@atlas/notifications` — preference-respecting render/send for the full 5-event launch-scope catalog, a delivery-status log, and preference CRUD.
- `@atlas/analytics` — Role-scoped read queries over the four materialized views plus a per-view staleness indicator, reusing Sprint 1's pre-seeded `reports:read_own_team`/`reports:read_organization` permission.
- `@atlas/quickbooks` — OAuth connect/disconnect/sync-status application layer plus `invoice.finalized`/`payment.received` sync consumers, built on the `integrations` schema.
- `job.dispatched` domain event — previously and deliberately unemitted since Sprint 5 ("no consumer justifies it yet"), now emitted by `@atlas/scheduling`'s `dispatchJob` and added to the Worker's `DOMAIN_EVENT_QUEUES`.
- Worker: real consumers for all 5 launch-scope events (fan-out on `job.completed` for its two independent consumers), a scheduled Analytics materialized-view refresh, and the QuickBooks sync consumer.
- 13 new/updated `/api/v1/` routes: notification preferences, notifications, four Analytics widgets, CSV exports, four QuickBooks integration endpoints, plus a new organization-wide Payments list (a genuine pre-existing gap this sprint's CSV export needed filled in).
- Staff UI: `/analytics` (four widgets with staleness indicators), `/settings/notifications` (preference matrix), `/settings/integrations` (QuickBooks connect/disconnect/sync-status), and "Export CSV" actions on the Jobs and Invoices list views.
- 37 new unit tests, 12 new integration tests (written, not executable in this sandbox — see "Tests").

Not implemented (explicitly out of scope, confirmed absent from the diff): async export-job queue, PDF generation/export-ready notifications, QuickBooks Customer/Item account-mapping (a documented simplification, not the full accounting integration), Technician self-utilization analytics, "retry sync" UI action, and OAuth-token field-level encryption at rest (no KMS/secrets-manager integration exists in this sandbox to do it with).

## Notifications Domain

`notifications.notifications` (send log: `queued → sent → delivered/bounced/failed`) and `notifications.notification_preferences` (per-owner, per-event-type, per-channel; absence of a row means enabled — an opt-out model matching the column's own `default(true)`). An owner is either a staff User (`owner_type='user'`) or a Portal Contact (`owner_type='contact'`, resolved via `crm.contacts.portal_user_id` — see `@atlas/notifications`'s `resolveOwnerRef`), mirrored exactly by `notifications`' own `recipient_type` discriminator.

`sendNotification` is the single entry point every Worker consumer calls per (event, recipient, channel): checks the preference (default-enabled), resolves the recipient's actual address (`@atlas/identity`'s `findUserById` for a User, `@atlas/crm`'s `findContactById` for a Contact), falls back SMS→email when no phone is on file (notifications-prd.md's documented edge case), renders the content (`renderNotificationContent`, one template per event × channel), and calls `@atlas/integrations`'s `sendEmail`/`sendSms`. A provider failure is caught and recorded as a `failed` notification row, never rethrown — notifications-prd.md's business rule that delivery failure never blocks the underlying business operation. Every launch-scope event is attempted on **both** channels independently per recipient (`notifyBothChannels` in the Worker), matching notifications-prd.md's acceptance criterion that a Customer with SMS disabled/email enabled gets exactly an email, not neither.

Recipients per event (`apps/worker/src/handlers/*`): `job.dispatched` → assigned Technician(s) + Customer's primary Contact; `job.completed`/`invoice.finalized`/`payment.received` → Customer's primary Contact; `estimate.approved` → assigned Technician(s), a documented interpretation of the architecture catalog's plain "notify staff" (see "Deviations From Documentation").

## Analytics Domain

Four materialized views, each Organization-scoped and further Role-scoped: Owner/Admin/Accountant (`reports:read_organization`) see organization-wide data; Dispatcher (`reports:read_own_team`) sees the same three widgets unfiltered — `mv_revenue_by_period`/`mv_job_volume_by_type`/`mv_invoice_aging` carry no Technician/Team dimension in their data model at all, so there is nothing to filter by — and a genuinely team-filtered `mv_technician_utilization`, resolved via `@atlas/identity`'s new `listTeamIdsForUser`/`listUserIdsForTeams`. This is a documented interpretation of `roles.md`'s single combined "Analytics/Reporting" row (see "Deviations From Documentation").

Because a materialized view structurally cannot carry an RLS policy, every read runs under `withServiceContext` (the connection's own elevated privileges) with the permission check and `organization_id` filter done explicitly in the application layer, plus `REVOKE ALL ... FROM PUBLIC, anon, authenticated` on every view as defense-in-depth — documented in migration 0029's header as the same "reviewed escape hatch" pattern `request-context.ts` establishes for Sprint 1's `create-organization`/`accept-invitation`, not a convenience shortcut.

Staleness is tracked by a new `analytics.view_refresh_log` table (an ordinary table, so it *can* carry RLS — enabled/forced with zero policies, an internal Worker-only record) updated by the Worker's scheduled refresh job. Each of the four views is refreshed independently (`REFRESH MATERIALIZED VIEW CONCURRENTLY`, one per view) rather than via the combined `analytics.refresh_all_materialized_views()` SQL function migration 0029 also creates — a real correctness fix found while implementing: `REFRESH MATERIALIZED VIEW CONCURRENTLY` cannot run inside a transaction block, so it's issued directly on the raw `db` client (autocommit), never inside `withServiceContext`'s `db.transaction(...)` wrapper, and per-view independence means one view's failure doesn't block recording the others' successful refresh time.

## QuickBooks / Integrations Domain

`integrations.integration_connections` (one row per Organization+provider; `access_token`/`refresh_token` stored as plain `text` — a disclosed simplification, see "Known Limitations") and `integrations.sync_records` (one row per synced entity, upserted by `(provider, entity_type, entity_id)`). The OAuth `state` parameter is a signed, self-contained, stateless token (`@atlas/quickbooks`'s `generateOAuthState`/`verifyOAuthState`, HMAC'd with `QUICKBOOKS_CLIENT_SECRET`) rather than a server-side session, mirroring `@atlas/identity`'s `invitation-token.ts` — there is no session store in this codebase to hold a mid-flow OAuth state in otherwise.

`syncInvoiceToQuickBooks`/`syncPaymentToQuickBooks` are the Worker's `invoice.finalized`/`payment.received` consumers: a missing/disconnected connection is a silent no-op (nothing to sync to), and a provider failure is caught and recorded in `sync_records` as `failed`, never thrown — integrations-prd.md's "a sync failure never blocks or reverses the underlying Atlas Invoice/Payment." `createQuickBooksInvoice`/`recordQuickBooksPayment` (`@atlas/integrations`) are real, structurally-correct wrappers around QuickBooks' Invoice/Payment APIs — every line item maps to one generic "Sales" Item and `CustomerRef` is a placeholder, since Atlas has no per-Organization QuickBooks Customer/Item account-mapping data model yet (see "Known Limitations").

## Reporting

Synchronous-only per the confirmed scope decision: `GET /api/v1/exports?resource_type=jobs|invoices|payments&organization_id=...&status=...` calls the exact same `listJobs`/`listInvoices`/`listPayments` application-layer functions the underlying list endpoints use (identical authorization/tenant-scoping, reporting-prd.md §8/§12), paginating internally up to `MAX_EXPORT_ROWS` (5000) and serializing via a new RFC-4180 `toCsv` utility. Building this exposed a real, pre-existing gap: **Payments had no organization-wide list endpoint at all** — only ever listed per-Invoice (`listPaymentsForInvoice`, Sprint 5). `@atlas/financials` gained `listPaymentsForOrganization`/`listPayments` and `apps/web` gained `GET /api/v1/payments` this sprint specifically so the CSV export's own stated exit criteria ("at least Jobs/Invoices/Payments") could be genuinely met rather than silently dropped.

## Permission Model

No new `notifications` or `analytics` permission resource. `reports:read_own_team`/`reports:read_organization` (Sprint 1's seed) exactly match Analytics' documented Dispatcher-Team/Owner-Admin-Accountant-org split. Notification-preference management requires no RBAC permission — self-scoped by identity. QuickBooks connect/disconnect/sync-status reuse `organization:manage_settings` (Owner/Admin-only), matching integrations-prd.md's "treated as a high-privilege action" framing.

One documented PRD/authoritative-table inconsistency, resolved the same way Sprint 6 resolved an identical one for Suppliers: `analytics-prd.md` §6/§12 describes a Technician "self-utilization" view, but `roles.md`'s table and the already-applied Sprint 1 seed grant Technician **no** `reports:*` permission at all. The seed/table win; Technician self-utilization is not implemented — verified by an integration test asserting `getRevenueByPeriod` throws `ForbiddenError` for a Technician actor.

## Database Changes

### Tables

`notifications.notifications`, `notifications.notification_preferences`, `integrations.integration_connections`, `integrations.sync_records`, `analytics.view_refresh_log` (an ordinary table) plus four materialized views (`analytics.mv_revenue_by_period`, `analytics.mv_job_volume_by_type`, `analytics.mv_technician_utilization`, `analytics.mv_invoice_aging`).

### Constraints

Every foreign key across the four new ordinary tables (8 FKs) is real and enforced, referencing `org.organizations`, `identity.users`, or `crm.contacts`. `uq_notification_preferences_user`/`uq_notification_preferences_contact`: two partial unique indexes substituting for one composite index, since exactly one of `owner_user_id`/`owner_contact_id` is set per row. `uq_sync_records_provider_entity`: full unique index on `(provider, entity_type, entity_id)`, the Worker's upsert target.

### Indexes

FK-covering indexes proactively added for every new foreign key (9 total), following Sprint 5/6 precedent. Each materialized view has a `CREATE UNIQUE INDEX` (required for `REFRESH ... CONCURRENTLY`) matching its natural key.

### Migrations

Applied live to the Atlas Project (`ucshfbwuoiohmkofqwte`) via `mcp__Supabase__apply_migration`, each verified afterward via `list_tables`/`execute_sql` before moving on (no placeholder-query incident this sprint, unlike Sprint 6):
- `0027_notifications_integrations_tables` — schemas, 6 enums, 4 tables, 8 FKs, 3 unique indexes.
- `0028_notifications_integrations_rls_and_audit` — 9 indexes, RLS policies, audit triggers (applied in 3 parts).
- `0029_analytics_materialized_views` — `analytics` schema, 4 materialized views with unique indexes and `REVOKE ALL`, plus the combined `refresh_all_materialized_views()` SQL function (applied in 2 parts).
- `0030_analytics_refresh_log` — the staleness-tracking table (found necessary partway through implementation, once "data as of HH:MM" was worked through concretely — Postgres has no built-in last-refreshed timestamp for a materialized view).

## RLS and Security

RLS enabled and forced on all five new ordinary tables (the four materialized views structurally cannot carry RLS at all — see "Analytics Domain"). `notifications.notifications`: `SELECT`-only for `authenticated` (`recipient_user_id = auth.uid()` OR `organization:manage_settings` OR the caller is the linked Portal Contact); no `INSERT`/`UPDATE` policy — Worker-only via `withServiceContext`, the same "internal record" pattern as `jobs.job_number_counters`. `notification_preferences`: full self-service `SELECT`/`INSERT`/`UPDATE`, `WITH CHECK` verifying the claimed `owner_user_id` has an active Membership in the claimed `organization_id` (or the claimed `owner_contact_id` belongs to that Organization). `integration_connections`/`sync_records`: gated on `organization:manage_settings`; `sync_records` is `SELECT`-only (Worker-only writes). `analytics.view_refresh_log`: RLS enabled/forced with **zero** policies — a full deny for `authenticated`, plus a redundant `REVOKE ALL` — since only the Worker's service-role connection ever touches it.

Tenant-isolation scenarios verified (written, integration-tier — see "Tests"):
1. Organization B's `listNotificationPreferences` call never returns Organization A's preference rows.
2. `sendNotification` records no notification row (and makes no provider call) when the target preference is disabled.
3. Technician gets `ForbiddenError` from every Analytics read (no `reports:*` permission).
4. Dispatcher's `getTechnicianUtilization` resolves to `'team'` scope; Owner's resolves to `'organization'`.
5. `mv_revenue_by_period`'s output reconciles exactly against a direct `SUM()` aggregate over `financials.payments` for the same Organization.
6. Technician gets `ForbiddenError` from both `getQuickBooksSyncStatus` and `disconnectQuickBooks`.
7. A second `disconnectQuickBooks` call against an already-disconnected connection 404s rather than silently no-op'ing.

## API Endpoints

`GET/PATCH /api/v1/notification-preferences`, `GET /api/v1/notifications` (`scope=self|organization`), `GET /api/v1/analytics/{revenue,job-volume,utilization,invoice-aging}`, `GET /api/v1/exports` (`resource_type=jobs|invoices|payments`, synchronous CSV), `GET /api/v1/payments` (new — see "Reporting"), `POST /api/v1/integrations/quickbooks/connect`, `GET /api/v1/integrations/quickbooks/callback` (OAuth redirect target — the one route in this sprint that returns an HTTP redirect rather than the `{data}` JSON envelope, mirroring `/api/v1/exports`'s own deliberate bypass of `withApiHandler` for its non-JSON `text/csv` response), `DELETE /api/v1/integrations/quickbooks`, `GET /api/v1/integrations/quickbooks/sync-status`. Every mutation derives `organization_id`/actor identity from authenticated context and request body/query, never a client-asserted ownership claim without a database-level cross-check — the same discipline as every prior sprint.

`access_token`/`refresh_token` are deliberately never serialized in the `integration_connections` API response — `apps/web/lib/quickbooks-serializers.ts`'s docstring makes this explicit, since these are secrets even the Organization's own Admin/Owner should never receive back over the API.

## UI

`/analytics` (four widgets, each with a "data as of" / stale indicator; no drill-down to underlying Job/Invoice lists — see "Known Limitations"), `/settings/notifications` (a per-event-type × per-channel checkbox matrix), `/settings/integrations` (QuickBooks connect/disconnect, a sync-records table with error detail; no "retry sync" action — see "Known Limitations"). The existing `/jobs` and `/invoices` list pages gained an "Export CSV" link honoring the page's current status filter.

## Audit Logging

Every mutating table gained an `app.record_audit_event()` trigger: `INSERT OR UPDATE` for `notifications`/`integration_connections`/`sync_records` (system/Worker-written, no `DELETE` path), `INSERT OR UPDATE OR DELETE` for `notification_preferences` (user-managed). A notification-preference *change* produces a standard Audit Event per notifications-prd.md §15; the notification send log itself is the separate operational delivery record, not an Audit Event.

## Background Jobs

The sprint's central background-processing addition: the Worker gained real consumers for all 5 launch-scope events (previously only `job.completed` had one), a new scheduled Analytics-refresh loop (hourly, `setInterval`, mirroring the existing domain-events/Stripe-webhook poll pattern), and the QuickBooks sync consumer folded into the `invoice.finalized`/`payment.received` handlers. `job.completed` is now a genuine fan-out: pg-boss allows only one `boss.work` registration per queue, so `index.ts` calls both `handleJobCompleted` (Financials, Sprint 5) and `handleJobCompletedNotifications` (new) from that single registration, in sequence.

## Idempotency

**A real, disclosed gap, not silently claimed as covered.** `@atlas/quickbooks`'s `sync_records` upsert (`onConflictDoUpdate` on `(provider, entity_type, entity_id)`) makes the Worker's own bookkeeping idempotent under pg-boss's at-least-once redelivery — but neither `sendNotification` nor `createQuickBooksInvoice`/`recordQuickBooksPayment` carry any redelivery-deduplication of their own: a redelivered `job.dispatched`/`job.completed`/etc. event would insert a second `notifications` row and attempt a second send, and a redelivered `invoice.finalized` would attempt to create a second Invoice in QuickBooks (no idempotency key is passed to Intuit's API, unlike `@atlas/integrations`'s Stripe client, which Sprint 5 built with a mandatory `idempotencyKey`). This is a genuine follow-up item, not addressed in this sprint — see "Known Limitations."

## Tests

### Unit Tests

37 new tests, all passing: `@atlas/integrations` +17 (Resend client/webhook 5, Twilio client/webhook 5, QuickBooks OAuth client/API client 7), `@atlas/notifications` 9 (event catalog 4, templates 5), `@atlas/analytics` 4 (staleness), `@atlas/quickbooks` 4 (OAuth state token), `apps/web` +3 (`csv.ts`). Combined with every prior sprint's unchanged suites, `pnpm -r test` passes 21 test-task packages, ~250+ tests total.

### Integration Tests (written, not executed — see below)

12 tests across three new files: `packages/notifications/src/integration/preferences-and-delivery.test.ts` (4 — preference default/override, tenant isolation, `sendNotification`'s skip-when-disabled and attempt-when-enabled paths), `packages/analytics/src/integration/analytics.test.ts` (4 — materialized-view accuracy against a direct aggregate, Owner/Dispatcher/Technician scope resolution), `packages/quickbooks/src/integration/connection-lifecycle.test.ts` (4 — permission gating, disconnect/sync-status against a directly-seeded connection row).

Coverage is representative, not exhaustive, and this is disclosed rather than implied otherwise: Accountant was not separately integration-tested for Analytics (it holds the identical `reports:read_organization` permission Owner's tested path already exercises); `listMyNotifications`/`listOrganizationNotifications`'s own permission-gating has no dedicated integration test (only `sendNotification`'s preference logic and the shared `resolveOwnerRef`/`requireNotificationsAdminAccess` primitives are covered); the real QuickBooks OAuth code-exchange path (`completeQuickBooksConnect`) has no integration test at all, since it requires a live network call to Intuit this sandbox cannot make — the connection-lifecycle test seeds a connection row directly instead.

### Why integration tests could not be executed

Unchanged from every prior sprint: this sandbox has no raw Postgres TCP egress. `DATABASE_URL`-requiring `pnpm test:integration` was not attempted this sprint given five consecutive sprints' identical confirmed failure mode — no test in this category is claimed to have passed.

### Security Tests

No SQL-injection-shaped input anywhere in Sprint 7: every new query uses Drizzle's parameterized query builder or `sql`-tagged-template interpolation; the one place a raw identifier is built via string position (`sql.identifier` for a materialized-view name in the refresh function) is sourced from a hardcoded 4-item literal array, never request-derived. Every mutating route validates its payload (Zod where the shape is non-trivial — `notification-preferences` PATCH; explicit type-narrowing for the single-field QuickBooks connect body). See "Security Findings" below for the full checklist pass.

## Validation Results

### Typecheck

`pnpm -r typecheck` — all 21 workspace packages pass, including the three new (`@atlas/notifications`, `@atlas/analytics` filled in from its Sprint-0 scaffold, `@atlas/quickbooks`) and every touched existing package (`@atlas/integrations`, `@atlas/identity`, `@atlas/crm`, `@atlas/financials`, `@atlas/scheduling`, `apps/worker`, `apps/web`). Two real bugs caught this way before ever reaching a test run: `tx.execute<T>()`'s generic constraint (`Record<string, unknown>`) rejects a plain `interface` row-shape declaration but accepts a `type` alias — hit identically across all four `@atlas/analytics` infra files, fixed by switching to `type`; `onConflictDoUpdate`'s `target` alone doesn't match a *partial* unique index without a matching `targetWhere` (`notification_preferences`'s two owner-type-specific indexes) — caught by reading Drizzle's own type signature before ever attempting to apply, not by a failed query.

### Lint

`pnpm -r lint` — all 21 packages pass with zero warnings, including `apps/web`'s `next lint`.

### Tests

`pnpm -r test` — all 21 test-task packages pass.

### Build

`apps/web`: `next build` succeeds — all 13 new/updated API routes and 3 new UI pages (`/analytics`, `/settings/notifications`, `/settings/integrations`) appear correctly in the route manifest alongside every prior sprint's routes.

## Security Findings

Retroactive Security Testing checklist pass (`docs/09-testing/security-testing.md`'s 6-item release-blocking list), scoped to this sprint's new surface, reported item-by-item and honestly:

1. **Tenant isolation** — RLS applied to all 5 new ordinary tables; the 4 materialized views (structurally RLS-incapable) are gated by an explicit application-layer permission check + `organization_id` filter instead, documented as the reviewed escape-hatch pattern. Verified by 12 written integration tests — not executed live (see "Tests").
2. **Authorization matrix** — every Role's expected access is implemented per the documented Permission model; Owner/Dispatcher/Technician are each explicitly tested for Analytics, Technician for QuickBooks. **Not fully exhaustive** — Accountant and Admin were not separately tested (same permission set as Owner in the seed data), and Notifications' own Admin-vs-self list-scoping has no dedicated test — disclosed above, not silently claimed complete.
3. **No new `any`/unvalidated input path** — confirmed via `grep`: zero `: any` type annotations across the new Notifications/Analytics/QuickBooks/Integrations surface; every mutating route validates its payload.
4. **No secret exposure** — confirmed via `grep`: `access_token`/`refresh_token` appear only in infra/application code that reads or writes them, never in a `logger.*` call or an API serializer; every `logger.warn`/`logger.error` call in the new Worker handlers logs only IDs and caught error messages, never a rendered notification body, OAuth token, or provider credential.
5. **Injection surface** — no raw SQL string interpolation from request input anywhere in the new code; the one identifier-interpolation case (`sql.identifier` for a materialized-view name) is sourced from a hardcoded literal, never user input.
6. **Idempotency** — **a real gap, disclosed, not fixed this sprint.** See "Idempotency" above: Notifications and the QuickBooks Invoice/Payment push have no redelivery-deduplication; only `sync_records`' own bookkeeping is upsert-safe. This is the one checklist item Sprint 7 does not fully pass, and it's called out explicitly rather than glossed over.

Standard advisor-style findings (not run via `mcp__Supabase__get_advisors` this sprint — no new call was made; based on direct migration review instead): every new RLS policy calling `auth.uid()` wraps it as `(select auth.uid())` (the InitPlan optimization), applied proactively per Sprint 5/6 precedent, not deferred to a follow-up fix migration.

## Documentation Changes

`docs/13-roadmap/sprint-7.md` (new) — authored at the start of this sprint from `ROADMAP-DECISION.md` Section C, the Notifications/Analytics/Reporting/Integrations PRDs, `event-driven-architecture.md`, and `security-testing.md`, including both `AskUserQuestion` scope-decision records and the pre-existing Documents-module gap noted (not fixed) against `ROADMAP-DECISION.md` Section E. `docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md` (this file). `.env.example` gained `RESEND_FROM_EMAIL`/`RESEND_WEBHOOK_SECRET`/`TWILIO_FROM_NUMBER`/`QUICKBOOKS_REDIRECT_URI` alongside the Sprint-0-anticipated `RESEND_API_KEY`/`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`QUICKBOOKS_CLIENT_ID`/`QUICKBOOKS_CLIENT_SECRET`.

## Architecture Decisions

1. **`@atlas/analytics` reads run under `withServiceContext`, never `withRequestContext`** — the only mechanism available at all, since Postgres materialized views structurally cannot carry RLS policies; the permission check and `organization_id` filter are done explicitly in application code instead, with `REVOKE ALL` as defense-in-depth.
2. **Materialized-view refresh is issued directly on `db`, never inside `withServiceContext`'s transaction wrapper** — `REFRESH MATERIALIZED VIEW CONCURRENTLY` cannot run inside an explicit transaction block; a real bug caught by researching Postgres's own documented restriction before implementing, not by a failed apply.
3. **Every launch-scope event is attempted on both channels independently**, not "whichever one preference resolves to" — matching notifications-prd.md's acceptance criterion precisely (SMS disabled + email enabled → email sent, no SMS attempted — which only follows if both are genuinely attempted and independently gated).
4. **The QuickBooks OAuth `state` parameter is a signed, stateless token, not a server-side session** — this codebase has no session store for a mid-flow value to live in between the connect redirect and the callback; mirrors `@atlas/identity`'s existing invitation-token pattern rather than inventing a new mechanism.
5. **`@atlas/financials` gained an organization-wide Payments list this sprint** (`listPaymentsForOrganization`/`listPayments`, plus `GET /api/v1/payments`) — not originally planned, but a genuine pre-existing gap discovered while implementing the CSV export route, which needed it to exist at all to meet this sprint's own stated exit criteria.
6. **`packages/quickbooks` is a new package, not folded into `packages/integrations`** — `packages/integrations` holds only typed provider *clients* (ADR-019's pattern, one per `src/<provider>` subdirectory within a single flat package); the `integration_connections`/`sync_records` *domain/application* layer (permission checks, OAuth-state signing, connection lifecycle) is a different architectural layer entirely and needed its own package, the same domain/infrastructure split every other module in this codebase follows.

## Deviations From Documentation

- Dispatcher's Analytics "own Team" scope is genuinely applied only to `mv_technician_utilization`; the other three widgets are unfiltered for any actor holding either `reports:read_own_team` or `reports:read_organization`, since revenue/job-volume/invoice-aging carry no Technician/Team attribution in their data model at all — see "Analytics Domain."
- `estimate.approved`'s "notify staff" (event-driven-architecture.md's catalog) is interpreted as the Job's assigned Technician(s) specifically, not a broader staff audience — no more specific recipient is named anywhere in the documented catalog or `notifications-prd.md`.
- Technician self-utilization (`analytics-prd.md` §6/§12) is not implemented — the authoritative `roles.md` table and Sprint 1 seed grant Technician no `reports:*` permission at all (same precedent as Sprint 6's Suppliers-permission resolution).
- No dedicated `/transfer`-style granular retry endpoint for QuickBooks sync failures (`integrations-prd.md` §13's "manual retry sync action") — not implemented this sprint, see "Known Limitations."
- User Journey 1's "Dispatches the job... via push notification" (`docs/00-overview/user-journeys.md`) is implemented as SMS/email, not a mobile push channel — the authoritative `event-driven-architecture.md` catalog itself says "SMS/email to Technician and Customer," which is what was built; the User Journey document's looser "push notification" phrasing is the inconsistent one here, resolved in favor of the architecture doc.

## Known Limitations

1. Integration tests are written but unexecuted in this sandbox (no raw Postgres TCP egress) — see "Tests."
2. **Notifications and QuickBooks Invoice/Payment sync have no redelivery-idempotency** — a real gap under pg-boss's at-least-once delivery, disclosed in full under "Idempotency"/"Security Findings" item 6, not fixed this sprint.
3. `access_token`/`refresh_token` on `integration_connections` are stored as plain `text`, not field-level-encrypted — this sandbox has no KMS/secrets-manager integration to encrypt with; a production deployment must add one before storing real OAuth tokens.
4. QuickBooks Invoice/Payment sync uses a placeholder `CustomerRef`/generic "Sales" `ItemRef` — no Customer/Item account-mapping data model exists yet; a real production integration needs one.
5. No "retry sync" UI action for failed `sync_records` (`integrations-prd.md` §13) — connect/disconnect/status-visibility only.
6. No drill-down from an Analytics aggregate to the underlying Job/Invoice list (`analytics-prd.md` §13) — the four widgets are read-only tables.
7. CSV export is bounded at 5,000 rows per request, not the fully unbounded/async-streamed export `reporting-prd.md` §17 describes for very large Organizations — a disclosed consequence of this sprint's confirmed synchronous-only scope decision.
8. No PDF generation, no export-ready notification, no `export_jobs` async queue — confirmed out of scope per the Reporting scope decision.
9. The pre-existing Documents (photo/form capture) gap flagged in `docs/13-roadmap/sprint-7.md` (`ROADMAP-DECISION.md` Section E lists it as MVP-required, built alongside Sprints 4–5, but no such module exists anywhere in the repository) remains unaddressed — outside this sprint's own documented scope, carried forward as an open item.
10. No live click-through testing of the staff UI in a browser (no running Supabase session available in this sandbox); typecheck/lint/build are the verification available — `next build`'s route-manifest inclusion confirms every new page/route compiles and is reachable, not that it renders/functions correctly end-to-end.

## MVP Readiness

Per `ROADMAP-DECISION.md` Section D, Sprint 7 is the last sprint before Strategic Phase 1 (MVP) can be considered code-complete — it depended on both Sprint 5 and Sprint 6, both shipped. All 12 deliverables in `docs/13-roadmap/sprint-7.md` are implemented; the exit criteria are met with the disclosed exceptions above (idempotency, the pre-existing Documents gap, and the confirmed-scoped-down Reporting/QuickBooks surface). The next work is Strategic Phase 2 (Property Intelligence, Sprint 8+), gated on whatever readiness criteria `ROADMAP-DECISION.md` Section D specifies at that point — not automatically "Sprint 8" by number, per the same document's own guidance followed at the top of every sprint doc since Sprint 3.
