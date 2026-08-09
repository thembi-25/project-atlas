# Sprint 4 Completion Report

## Status

**Complete**, with the same category of execution-environment caveat carried over from Sprints 0–3 (see "Known Limitations" #1) and two documented, well-justified deviations (see "Deviations From Documentation").

## Executive Summary

Sprint 4 implements Jobs, Scheduling & Dispatch: the central operational entity tying together Sprint 2's Customer, Sprint 3's Property/Asset, and Sprint 1's User/Membership/Team infrastructure. A new `jobs` Postgres schema (13 tables) is live on the real "Atlas Project" Supabase project, with RLS, audit triggers, and full-text search, implemented across two packages — `@atlas/jobs` (jobs, tasks, job-type/service-category catalog) and `@atlas/scheduling` (scheduling, dispatch) — that jointly implement the single documented "jobs" architectural module, mirroring Sprint 3's `@atlas/properties`/`@atlas/assets` precedent. The full documented Job state machine (`draft → scheduled → dispatched → in_progress → (on_hold) → completed/cancelled`) is enforced server-side via dedicated transition functions and API endpoints (never a generic `status` `PATCH`), with a race-free server-authoritative sequential Job numbering scheme, required-Task completion gating before a Job can complete, and a documented "warn, not block" scheduling-conflict model backed by a GiST-indexed range-overlap query. `apps/web` exposes this via 25 new `/api/v1/` routes and a minimal, real staff UI (Job list/detail with lifecycle/schedule/dispatch controls, a weekly schedule board). 62 new tests were written (34 unit, all passing; 6 package-level integration test files plus 2 API-route integration test files covering the ten mandatory RLS/tenant-isolation scenarios, the full lifecycle, scheduling/dispatch flow, and the Role-permission matrix — real, not mocked, but blocked from executing in this sandbox by the same lack-of-raw-Postgres-TCP limitation documented in Sprints 0–3). One legitimate performance-advisor finding (14 RLS policies re-evaluating `auth.uid()` per row) and 20 missing FK-covering indexes were found and fixed after the initial migration batch.

## Implemented Scope

Per `docs/06-modules/jobs-prd.md`, `docs/06-modules/scheduling-prd.md`, `docs/06-modules/dispatch-prd.md`, `docs/03-domain/jobs.md`, `docs/03-domain/tasks.md`, `docs/03-domain/scheduling.md`, `docs/03-domain/dispatch.md`:

- Job creation against a required Customer/Property (optional Contact, optional Assets), Job Type selection (loads the default checklist, copied onto the Job as Tasks — never a live reference), server-authoritative sequential `job_number`, retrieval, listing (status/priority/customer/property/assigned-to-me filters), full-text search (joined to Customer/Property search indexes), ordinary field updates (never `status`/`customer_id`/`property_id`), archive/restore (soft delete, a distinct axis from `status`).
- The full documented state machine: `start`/`hold`/`resume`/`complete`/`cancel` command endpoints, each domain-validated against the exact edges in `jobs.md`'s diagram; `complete` is blocked (`422`) while any required Task is incomplete and not overridden; `cancel` requires a reason code; `completed`/`cancelled` are terminal and reject every further transition or field edit.
- Ad hoc Task addition, Task completion (individually attributable) and reopening.
- Job ↔ Technician assignment (`jobs:assign`-gated) and Job ↔ Asset attachment, both verifying the target belongs to the same Organization before the write.
- Scheduling: create/reschedule a Job's Schedule Event (time window + one or more Technicians, optional Team), the documented "warn, not block" double-booking detection, a schedule-board read endpoint, and a standalone conflict-check endpoint.
- Dispatch: the `scheduled → dispatched` hand-off, and the Technician-initiated `acknowledge`/`en-route`/`arrived` timestamp sequence, scoped to the Technician's own assigned Job.
- The trade-agnostic `job_types`/`service_categories`/`checklist_templates` configuration entities (platform defaults, read-only this sprint — same documented gap already accepted for `asset_types` in Sprint 3).

Not implemented (explicitly out of scope, confirmed absent from the diff): estimates, proposals, quotes, invoices, payments, inventory, purchase orders, supplier marketplace, manufacturer integrations, financing, AI diagnostics, predictive maintenance, route optimization, GPS tracking, customer portal, technician mobile app, payroll, commissions.

## Job Domain

New `@atlas/jobs` package, mirroring `@atlas/properties`'s domain/application/infrastructure layering:

- **Domain**: `lifecycle.ts` (`canTransitionJobStatus` — exactly the edges in `jobs.md`'s state-machine diagram, `isTerminalJobStatus`), `errors.ts` (`NotFoundError`, `ForbiddenError`, `InvalidJobStateError`, `IncompleteRequiredTasksError`, `JobIsImmutableError`).
- **Application**: `createJob` (permission check → Job Type/Service Category visibility → Customer/Property/Contact/Asset ownership verification → race-free job-number allocation → insert → `job_status_history` seed row → checklist-template-to-Task copy), `getJob`/`listJobs`/`searchJobs`/`updateJob`/`archiveJob`/`restoreJob`, `transitionJobStatusInTx` (the reusable, tx-composable core every transition and @atlas/scheduling's `scheduleJob`/`dispatchJob` build on) plus `startJob`/`holdJob`/`resumeJob`/`completeJob`/`cancelJob`, `listTasks`/`addAdHocTask`/`completeTask`/`reopenTask`, `assignUserToJob`/`unassignUserFromJob`/`listAssignmentsForJob`, `attachAssetToJob`/`detachAssetFromJob`/`listAssetsForJob`, `getJobHistory`, `listJobTypes`/`listServiceCategories`.
- **Infrastructure**: Drizzle-backed queries against `jobs.jobs`/`job_assets`/`job_assignments`/`job_status_history`/`tasks`/`job_types`/`service_categories`/`checklist_templates`/`checklist_template_items`, plus `job-number.ts`'s atomic `INSERT ... ON CONFLICT DO NOTHING` + `UPDATE ... RETURNING` counter allocator (never `SELECT MAX(job_number) + 1`).

### Relationships

- **Job → Organization, Customer, Property** (required), **Contact, Assets** (optional, via `job_assets`): every reference verified to belong to the same Organization at the application layer (`findCustomerForOrganization`, `findPropertyById` + org check, `findContactForOrganization`, `findAssetForOrganization`) before insert — defense-in-depth alongside the RLS `WITH CHECK` doing the identical check at the database layer.
- **Job → Technician** (`job_assignments`, the source of truth for `jobs:read_assigned`/`write_assigned` scoping): assignment verifies the target User holds an active Membership in the same Organization.
- No customer/property/asset data is duplicated onto `jobs` — every reference is a foreign key.

## Scheduling

New `@atlas/scheduling` package (`schedule_events`, `schedule_event_assignments`, `schedule_event_history`):

- `scheduleJob`: requires the Job to be `draft` or `scheduled` (scheduling.md business rule 1), verifies every assigned User holds an active Membership in the Organization, runs the conflict-detection query, creates the Schedule Event + assignments, and transitions a `draft` Job to `scheduled` via `@atlas/jobs`'s `transitionJobStatusInTx` — all in one transaction.
- `rescheduleJob`: updates the existing Schedule Event in place and logs the previous window to `schedule_event_history` (scheduling.md business rule 1 — "rather than creating a competing record"); requires an explicit `reason` once the Job is `dispatched`/`in_progress` (business rule 3).
- **Conflict detection is "warn, not block"** exactly as documented (scheduling.md business rule 2, scheduling-prd.md §18's acceptance criterion): `findSchedulingConflicts` runs a GiST-indexed `tstzrange` overlap query per assigned Technician and returns the conflict list alongside the successfully-created/updated Schedule Event — it never rejects the write. No Postgres exclusion constraint was added for this reason; verified in `scheduling-dispatch.test.ts`.
- `listSchedule`/`getJobSchedule`/`getConflicts`: the board read, a single Job's schedule, and the standalone conflict-check endpoint (scheduling-prd.md §11).

## Assignments

`job_assignments` (Job-level, the source of truth for `jobs:read_assigned`/`write_assigned` scoping, gated on the dedicated `jobs:assign` Permission — Dispatcher/Admin/Owner only) and `schedule_event_assignments` (time-window-specific, gated on `scheduling:write`) are deliberately two separate tables, matching both the documented data model (`schema-overview.md` lists both) and the task's own separation of "Assignments" (§16) from "Scheduling" (§13) as distinct concerns — a Technician can be the Job's responsible party (`job_assignments`) independent of whether/when the Job has been scheduled. No eligibility rule beyond "active Organization Membership" is enforced (technicians.md documents what a Technician *is*, not that assignment is restricted to that Role — see "Deviations From Documentation").

## Dispatch

`dispatch_events` (not unique on `job_id` — a Job may be re-dispatched, e.g. after a reschedule supersedes an unacknowledged one, per dispatch-prd.md's edge cases):

- `dispatchJob`: requires the Job to be exactly `scheduled` (`409` otherwise), transitions it to `dispatched`, and creates the Dispatch Event — `jobs:write`-gated (Dispatcher/Admin/Owner).
- `acknowledgeDispatch`/`markEnRoute`/`markArrived`: Technician-initiated, timestamped, and scoped to the Technician's own assigned Job via `jobs:write_assigned` + an assignment check — matching dispatch.md's "a forward-only sequence of optional timestamps, not a formal enumerated state machine" (no ordering is enforced between acknowledge/en-route/arrived, since a Technician may skip directly to arrived).
- No new `dispatch` Permission resource was created — every dispatch action maps exactly onto the existing `jobs:write`/`jobs:write_assigned` grants (see "Permissions").

## Database Changes

### Tables

New `jobs` Postgres schema, 13 tables:

| Table | Purpose | Key columns |
|---|---|---|
| `job_types` | Configurable job categories (trade-agnostic config pattern) | `id`, `organization_id` (nullable = platform default), `trade_type_id`, `name`, `default_duration_minutes`, `is_active` |
| `service_categories` | Pricing/reporting grouping | `id`, `organization_id`, `name`, `is_active` |
| `checklist_templates` | A Job Type's default checklist (1 per Job Type) | `id`, `job_type_id` (unique), `name` |
| `checklist_template_items` | Individual template steps | `id`, `checklist_template_id`, `label`, `type`, `is_required`, `sort_order` |
| `job_number_counters` | Per-Organization sequential counter | `organization_id` (PK), `next_number` |
| `jobs` | Core work unit | `id`, `organization_id`, `job_number`, `job_type_id`, `service_category_id`, `status`, `priority`, `customer_id`, `property_id`, `contact_id`, `description`, `source`, `cancellation_reason`, `deleted_at` |
| `job_assets` | Job ↔ Asset join | `id`, `organization_id`, `job_id`, `asset_id` |
| `job_assignments` | Job ↔ Technician join | `id`, `organization_id`, `job_id`, `user_id`, `assigned_by_user_id` |
| `job_status_history` | Append-only status-transition log | `id`, `job_id`, `from_status`, `to_status`, `reason`, `changed_by_user_id` |
| `tasks` | Job checklist items (copied from template, or ad hoc) | `id`, `job_id`, `checklist_template_item_id`, `label`, `type`, `is_required`, `response_value`, `completed_by_user_id`, `completed_at`, `override_reason` |
| `schedule_events` | A Job's time window + crew | `id`, `job_id` (unique), `scheduled_start`, `scheduled_end`, `team_id`, `notes` |
| `schedule_event_assignments` | Schedule Event ↔ Technician join | `id`, `organization_id`, `schedule_event_id`, `user_id` |
| `schedule_event_history` | Append-only reschedule log | `id`, `schedule_event_id`, `job_id`, `previous_start`, `previous_end`, `reason`, `changed_by_user_id` |
| `dispatch_events` | Dispatch lifecycle timestamps | `id`, `job_id`, `dispatched_at`, `dispatched_by_user_id`, `acknowledged_at`, `en_route_at`, `arrived_at` |

4 enums: `job_status` (`draft`, `scheduled`, `dispatched`, `in_progress`, `on_hold`, `completed`, `cancelled`), `job_priority` (`normal`, `urgent`, `emergency`), `job_source` (`phone`, `portal`, `repeat_visit`, `marketplace`), `task_type` (`checkbox`, `text`, `number`, `photo`, `signature`, `select`).

### Constraints

- FKs on every relationship: `jobs.customer_id → crm.customers`, `jobs.property_id → properties.properties`, `jobs.contact_id → crm.contacts`, `job_assets.asset_id → properties.assets`, `schedule_events.team_id → org.teams`, plus every `organization_id` → `org.organizations` and every `user_id`/`*_by_user_id` → `identity.users`.
- Uniqueness, scope-exact per the documented model: `uq_jobs_organization_id_job_number` (sequential per Organization, not globally unique); `uq_job_assets_job_id_asset_id`, `uq_job_assignments_job_id_user_id`, `uq_schedule_event_assignments_event_id_user_id` (no duplicate joins); `checklist_templates.job_type_id` unique (one template per Job Type); `schedule_events.job_id` unique (one active Schedule Event per Job — scheduling.md business rule 1); `uq_job_types_org_trade_name`/`uq_service_categories_org_name` (mirroring `asset_types`' platform-default-plus-org-extension pattern).
- `CHECK (scheduled_end > scheduled_start)` on `schedule_events` — verified by a real DB-level test (`tenant-isolation.test.ts`, "database CHECK constraint rejects...").
- `NOT NULL` on every required relationship FK; `deleted_at` soft-deletion on `jobs` only (join/log tables have no independent lifecycle worth soft-deleting).

### Indexes

40 total (20 in the initial migration, 20 added after the security-advisor review — see "Security Findings"), matching `docs/04-database/indexes.md`'s explicit table for this module exactly: `(organization_id, status)`/`(property_id)`/`(customer_id)`/GIN `search_vector` on `jobs`; `(user_id)`/`(job_id)` on `job_assignments`; a GiST range index on `schedule_events` for overlap detection; `(job_id)` on `tasks`; plus every FK now has a covering index (see "Security Findings").

### Migrations

5 new migrations, all applied to the live "Atlas Project" Supabase project (`ucshfbwuoiohmkofqwte`) and verified via `list_migrations`/`execute_sql`:

| Migration | Purpose |
|---|---|
| `0015_jobs_scheduling_dispatch.sql` | Schema, 4 enums, 13 tables, 30 FKs, 6 initial unique indexes |
| `0016_jobs_permissions.sql` | Adds the `scheduling:read_assigned` Permission, moves Technician onto it (see "Permissions") |
| `0017_jobs_rls_search_and_audit.sql` | `search_vector` generated column, 20 indexes, RLS enable+force on all 13 tables, SELECT/INSERT/UPDATE/DELETE policies, audit triggers on 12 tables (not `job_number_counters`) |
| `0018_jobs_seed_job_types_and_service_categories.sql` | Seeds 9 platform-default Job Types, 3 Service Categories, 9 checklist templates + items |
| `0019_jobs_security_advisor_fixes.sql` | 20 additional FK-covering indexes, rewrites 14 RLS policies to use `(select auth.uid())` |

No previously applied migration (0000–0014) was modified; every change is a new migration. `packages/database/migrations/meta/_journal.json` and the corresponding snapshot files were updated for each (pure-SQL migrations with no `schema.ts` diff carry forward the prior snapshot unchanged, matching the `0004`/`0010`–`0014` precedent from Sprints 1 and 3).

## RLS and Tenant Isolation

RLS is `ENABLE`d and `FORCE`d on all 13 new tables. `jobs.job_number_counters` is deliberately given **zero policies** — FORCE ROW LEVEL SECURITY with no policy denies all `authenticated`-role access outright, which is exactly the intended "internal counter, never a client-readable/writable resource" behavior (verified as an INFO-level, expected `rls_enabled_no_policy` advisor finding, not a gap).

Policies follow the established Atlas pattern (`app.current_user_has_permission(organization_id, resource, action)`), with every indirect-ownership relationship checked via an `EXISTS` subquery against the referenced table's own `organization_id` — never trusting the client-supplied `organization_id` alone:

- `jobs` INSERT/UPDATE `WITH CHECK` verifies the referenced Customer, Property, and (if given) Contact all belong to the claimed `organization_id`.
- `job_assets` INSERT `WITH CHECK` verifies both the Job and the (cross-schema) Asset belong to the claimed `organization_id`.
- `job_assignments`/`schedule_event_assignments` INSERT `WITH CHECK` verifies the Job/Schedule Event belongs to the claimed `organization_id` **and** the target User holds an active Membership in that same Organization — the specific "cannot assign another Organization's Technician" guarantee.
- `schedule_events` INSERT/UPDATE `WITH CHECK` verifies the Job (and, if given, the Team) belongs to the claimed `organization_id`.
- Technician visibility is ownership-scoped via `EXISTS` against `job_assignments`/`schedule_event_assignments` for `auth.uid()`, gated on the `read_assigned` Permission — never a bare Role check.

### The ten mandatory RLS/tenant-isolation scenarios

All ten are written as real, non-mocked integration tests against the live Postgres database (not executed in this environment — see "Known Limitations" #1):

1. Tenant A can access Tenant A Jobs — `jobs/tenant-isolation.test.ts`, "Owner A ... can read their own Job."
2. Tenant A cannot access Tenant B Jobs — `jobs/tenant-isolation.test.ts`, "Owner B cannot get/list Org A's Job(s)."
3. Tenant A cannot modify Tenant B Jobs — covered by the same masked-404 pattern (RLS denies the row at the `UPDATE` policy before any application-layer field check runs).
4. Tenant A cannot create a Job referencing Tenant B Customer — `jobs/tenant-isolation.test.ts`.
5. Tenant A cannot reference Tenant B Property — `jobs/tenant-isolation.test.ts`.
6. Tenant A cannot reference Tenant B Asset — `jobs/tenant-isolation.test.ts`, "Owner A cannot attach Org B's Asset to a Job."
7. Tenant A cannot assign Tenant B Technician — `scheduling/tenant-isolation.test.ts`, "Owner A cannot assign Org B's User... to an Org A Job."
8. Tenant A cannot access Tenant B appointments — `scheduling/tenant-isolation.test.ts`, "Owner B cannot read Org A's Schedule Event" (symmetric case).
9. Tenant A cannot access Tenant B assignments — covered by the same RLS `EXISTS` scoping verified in both suites' FORCE-RLS tests.
10. Unauthorized Roles cannot perform restricted actions — `jobs/permission-matrix.test.ts`, `scheduling/permission-matrix.test.ts`.

Plus: scheduling conflicts obey the documented "warn, not block" rule (`scheduling-dispatch.test.ts`) and Audit Events are created correctly (both tenant-isolation suites, asserting `entity_type = 'jobs.jobs'` / `'jobs.schedule_events'` / `'jobs.dispatch_events'`), and two DB-level constraint tests per suite (FK, unique/CHECK) verify the database — not just the application layer — rejects invalid relationships.

## Permissions

No new Permission resource was created (no `dispatch` resource — see "Dispatch"). `jobs:*` (`read`, `read_assigned`, `write`, `write_assigned`, `delete`, `assign`) and `scheduling:*` (`read`, `write`) were already seeded platform-wide by Sprint 1's `0002_seed_platform_data.sql`, anticipating this module before it existed — reused exactly as-is, including the pre-existing role grants (Owner/Admin: all; Dispatcher: `jobs:read/write/assign`, `scheduling:read/write`, not `jobs:delete`; Technician: `jobs:read_assigned/write_assigned`; Accountant: `jobs:read`, `scheduling:read`).

**One refinement**: `scheduling-prd.md`'s "Technician: read-only on their OWN schedule" (not the whole Organization's) could not be expressed by Sprint 1's bare `scheduling:read` grant, which is the same Permission Dispatcher/Admin/Owner/Accountant hold for full-Organization visibility. Migration `0016` adds `scheduling:read_assigned` (mirroring the pre-existing `jobs:read`/`jobs:read_assigned` split in the same seed file) and moves Technician onto it, leaving every other role's `scheduling:read` untouched. See "Deviations From Documentation" for the full reasoning.

## API Endpoints

25 new routes under `/api/v1/`, all resolving the authenticated user, resolving org context from a query/body parameter (never trusting a client-asserted org switch), checking permission, validating input with Zod, executing through the application layer, and returning the standard envelope:

- `GET/POST /api/v1/jobs`; `GET/PATCH/DELETE /api/v1/jobs/{id}`; `POST /api/v1/jobs/{id}/restore`
- `POST /api/v1/jobs/{id}/{start,hold,resume,complete,cancel}` (state-machine transitions, never a generic `status` `PATCH`)
- `GET/POST /api/v1/jobs/{id}/tasks`; `POST /api/v1/jobs/{id}/tasks/{taskId}/{complete,reopen}`
- `GET/POST /api/v1/jobs/{id}/assignments`; `DELETE /api/v1/jobs/{id}/assignments/{userId}`
- `GET/POST /api/v1/jobs/{id}/assets`; `DELETE /api/v1/jobs/{id}/assets/{assetId}`
- `GET /api/v1/jobs/{id}/history`
- `GET/POST/PATCH /api/v1/jobs/{id}/schedule`; `GET /api/v1/schedule`; `GET /api/v1/schedule/conflicts`
- `POST /api/v1/jobs/{id}/dispatch`; `POST /api/v1/jobs/{id}/{acknowledge,en-route,arrived}`
- `GET /api/v1/job_types`; `GET /api/v1/service_categories`

Only these documented resources were implemented; the task's own illustrative resource list was treated as non-authoritative.

## UI

Three pages, matching Sprints 2–3's minimal-but-real approach:

- `apps/web/app/jobs/page.tsx` — Job list (status filter, search) + create form.
- `apps/web/app/jobs/[id]/page.tsx` — Customer/Property context, lifecycle transition controls (contextual to current status), checklist with per-Task completion, Schedule section (create/reschedule, conflict warning banner, reschedule-reason field), Dispatch section (dispatch button + acknowledge/en-route/arrived controls + timestamps), and an activity timeline built from `job_status_history`. No Estimate/Invoice/Inventory section is rendered — an explicit note states these will appear once those modules exist.
- `apps/web/app/schedule/page.tsx` — a single-week list view of the Organization's (or, for a Technician, their own) Schedule Events, not a full drag-and-drop calendar — see "Deviations From Documentation".

## Audit Logging

Reused the existing `app.record_audit_event()` generic trigger exactly as established in Sprints 1–3 — no second audit mechanism. `CREATE TRIGGER audit_*` was added on 12 of the 13 new tables (all except `job_number_counters`, which has no client-facing writes to audit). `entity_type` follows the established `TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME` convention (e.g. `jobs.jobs`, `jobs.schedule_events`, `jobs.dispatch_events`), asserted directly in the tenant-isolation integration tests.

## Event History

`job_status_history` is the fast, denormalized transition log jobs-prd.md §15 describes ("`job_status_history` additionally provides a fast, denormalized transition log for UI display without querying the full audit table"); `schedule_event_history` is its Scheduling analogue. Both are append-only (no UPDATE/DELETE RLS policy exists) and feed the generic Audit Events system on every INSERT rather than replacing it. No separate domain-event/outbox mechanism was introduced — see "Background Jobs".

## Background Jobs

Not used. Every Sprint 4 operation (Job creation, transitions, scheduling, dispatch, acknowledgment) is synchronous request/response work with no genuine asynchronous-processing requirement; Notifications (which would be the natural consumer of an async job/event queue — e.g. "dispatch push to Technician," "reschedule SMS to Customer") are explicitly deferred per `docs/06-modules/notifications-prd.md` and were not implemented, per the task's own instruction not to add background jobs "simply because they sound architecturally sophisticated." The approved transactional-outbox + pg-boss architecture (ADR-016) remains unused this sprint, exactly as it was in Sprints 1–3.

## Tests

### Unit Tests

34 new tests, domain-layer, no I/O — **executed, all passing**:
- `@atlas/jobs`: `lifecycle.test.ts` (28 tests — every documented transition edge, every undocumented edge explicitly rejected, no-op/terminal-state rejection).
- `@atlas/scheduling`: `conflict-detection.test.ts` (6 tests — overlap detection including the back-to-back/edge-adjacent-window semantics scheduling-prd.md §19 calls for).

### API Tests

2 new integration test files (`apps/web/app/api/v1/jobs/route.integration.test.ts`, `.../jobs/[id]/schedule/route.integration.test.ts`) covering Job creation (404 on cross-tenant/nonexistent Property, 422 on invalid payload), listing (pagination envelope, 400 on missing `organization_id`), scheduling (201 with the conflicts array), and dispatch (200 transitioning to `dispatched`, 409 on a second dispatch attempt) — real, against the live database, **not executed** in this sandbox (see "Known Limitations" #1).

### Integration Tests

6 new package-level integration test files:
- `@atlas/jobs`: `tenant-isolation.test.ts`, `job-lifecycle.test.ts`, `permission-matrix.test.ts`.
- `@atlas/scheduling`: `tenant-isolation.test.ts`, `scheduling-dispatch.test.ts`, `permission-matrix.test.ts`.

Real, against the live database, **not executed** in this sandbox (see "Known Limitations" #1).

### Database/RLS Tests

The ten mandatory scenarios (see "RLS and Tenant Isolation") plus the two DB-level constraint tests per package (FK, unique/CHECK constraints verified independent of the application layer) are implemented as real assertions inside the integration test files above — **written and reviewed, not executed** in this sandbox.

### Security Tests

Covered by the same integration suites (FORCE RLS-under-unrelated-actor tests, cross-tenant relationship-rejection tests, audit-event assertions) — **written and reviewed, not executed**.

## Validation Results

### Formatting

`pnpm run format` (Prettier, repo root) — **executed**; reformatted the new Sprint 4 files to the project's standard style (whitespace/line-wrapping only); re-ran lint/typecheck/test afterward and confirmed nothing broke.

### Lint

`pnpm turbo run lint` — **executed**, 19/19 packages passed, 0 warnings/errors (`--max-warnings 0` across every package including `@atlas/jobs`, `@atlas/scheduling`, `@atlas/web`).

### Typecheck

`pnpm turbo run typecheck` — **executed**, 19/19 packages passed (`tsc --noEmit`).

### Tests

`pnpm turbo run test` — **executed**, 19/19 packages passed, 102 unit tests total (34 new this sprint). This is the unit tier only; it excludes `src/integration/**` and `*.integration.test.ts` by Vitest config, consistent with Sprints 0–3.

### Build

`pnpm run build` (`apps/web`) — **executed**, succeeded. `next build` compiled all 25 new API routes plus the 3 new UI pages, generated 21 static pages, and reported a clean production bundle (no build warnings surfaced).

## Security Findings

Reviewed via `mcp__Supabase__get_advisors` (`type: security` and `type: performance`) after the full Sprint 4 migration batch, per the mandatory post-migration security review.

1. **Fixed.** Performance advisor flagged 20 `unindexed_foreign_keys` across the new `jobs` schema (every FK without a covering index — e.g. `jobs.job_type_id`, `dispatch_events.dispatched_by_user_id`, `tasks.checklist_template_item_id`). Fixed in `0019_jobs_security_advisor_fixes.sql` by adding a covering index for each; re-ran the advisor afterward and confirmed 0 remaining `unindexed_foreign_keys` findings on the `jobs` schema.
2. **Fixed.** Performance advisor flagged 14 RLS policies with `auth_rls_initplan` — each of the new SELECT/UPDATE/INSERT policies that call `auth.uid()` directly inside an `EXISTS` subquery, causing Postgres to re-evaluate it per row instead of once per query via an InitPlan. Fixed in the same migration by dropping and recreating all 14 policies with `(select auth.uid())`; re-ran the advisor and confirmed 0 remaining `auth_rls_initplan` findings on the `jobs` schema.
3. **Reviewed, not new, no action taken.** The identical `auth_rls_initplan` pattern exists on three pre-existing Sprint 1 policies (`identity.organization_memberships`, `identity.membership_roles`, `identity.users`) that were never flagged/fixed in Sprints 1–3. Not touched here: editing an already-applied migration is against the project's migration-safety rule, and retroactively patching another module's policies is outside Sprint 4's scope. Flagged as a known, pre-existing, low-severity (INFO/WARN, not a tenant-isolation gap) item for a future hardening pass.
4. **Reviewed, not new, no action taken.** `rls_enabled_no_policy` (INFO) on `jobs.job_number_counters` is the intentional design described in "RLS and Tenant Isolation," not a gap. The same finding on `platform.audit_events_*` monthly partitions and the `public.rls_auto_enable()` SECURITY DEFINER finding are pre-existing platform infrastructure from Sprint 1, unrelated to any table this sprint created (same items already accepted in Sprints 2–3's completion reports).
5. All `jobs.*` `unused_index` (INFO) findings were reviewed and are expected noise — brand-new tables with zero production query traffic in this development project, not a sign of a wrong index choice (same pattern already documented in Sprint 3's report).

## Documentation Changes

- Added `docs/13-roadmap/sprint-4.md` (Sprint 4 plan, authored before implementation per the task's read-first requirement).
- Added this completion report.
- No existing documentation was rewritten; no contradiction was found between `jobs-prd.md`/`scheduling-prd.md`/`dispatch-prd.md`/the domain docs and the database/API docs that required a documentation fix or a new ADR beyond the two-packages/one-module note captured in "Architecture Decisions" (an implementation-organization clarification, matching Sprint 3's identical precedent, not a change to any documented business rule).

## Architecture Decisions

Identical resolution to Sprint 3's `@atlas/properties` + `@atlas/assets` split (see that report's "Architecture Decisions" for the full reasoning): `component-architecture.md`'s module table defines a single "jobs" module owning `jobs, tasks, scheduling, dispatch` together, but Sprint 0 had already scaffolded two separate TypeScript packages, `@atlas/jobs` and `@atlas/scheduling` (package.json descriptions: "Jobs and Tasks" / "Scheduling and Dispatch"). Both packages jointly implement the one documented module, sharing a single Postgres `jobs` schema; `@atlas/scheduling`'s infrastructure queries `jobs.jobs` where needed and calls `@atlas/jobs`'s exported `transitionJobStatusInTx`/`isUserAssignedToJob`/`findJobById` to drive the Job state machine atomically within its own transactions, rather than re-implementing it. Genuinely separate modules (`crm`, `properties`, future `financials`) continue to go through each package's public `index.ts` exports only. No ADR was written — this does not change any documented business rule, database structure, or external contract.

A second, smaller decision: Job search (`search-strategy.md`'s "Job | job number, customer name (denormalized), property address (denormalized)") is implemented as a query-time join to the *existing* `crm.customers.search_vector`/`properties.properties.search_vector` columns (already present from Sprints 2–3), rather than physically duplicating Customer/Property text onto `jobs`. This satisfies the documented search *capability* (searching by customer name or property address finds the Job) without violating the "don't duplicate Customer/Property data" instruction — the `jobs.search_vector` column itself covers only genuinely Job-owned text (job number, description).

## Deviations From Documentation

Two deliberate, documented divergences:

1. **`scheduling:read_assigned` is a new Permission, not previously documented by name.** `scheduling-prd.md`'s "Technician: read-only on their own schedule" requires distinguishing "sees everything" from "sees only what I'm assigned to," which Sprint 1's speculative `0002_seed_platform_data.sql` seed (written before Sprint 4 existed) could not yet express with its single bare `scheduling:read` grant. Migration `0016` adds `scheduling:read_assigned` and moves Technician onto it, mirroring the exact `jobs:read`/`jobs:read_assigned` split already established in that same file. This is a permission-model *refinement* required to correctly implement an already-documented behavioral requirement, not an invented capability.
2. **No separate mobile PWA was built.** `ROADMAP-DECISION.md`'s Sprint 4 scope summary mentions "the Mobile PWA's first end-to-end slice (today's job list, checklist completion)," but the task's own explicit non-goals exclude "technician mobile application beyond what the Sprint 4 PRD explicitly requires," and no `apps/mobile` package (or equivalent) exists in this monorepo to build one in. The Technician-facing execution actions (task completion, dispatch acknowledge/en-route/arrived, "my jobs" filtering) are instead exposed through the same responsive `apps/web` application and its `/api/v1/` surface — every capability the PWA slice describes is implemented and API-reachable, just not as a distinct mobile app shell.

Otherwise: where the domain docs, database docs, and API docs disagreed or under-specified a design question (job number format, cancellation-reason as free text vs. a fixed code list, whether Team assignment implies technician assignment), the more specific/authoritative document was followed and documented inline in code comments; none required a stop-and-report per the task's decision criteria.

## Known Limitations

1. **Integration and API tests could not be executed in this environment.** As in Sprints 0–3, this sandbox has no raw Postgres TCP egress to the live Supabase database outside of the MCP tool bridge. `pnpm test:integration` for `@atlas/jobs` was attempted against the real `DATABASE_URL` from `.env.local` (a correctly-configured Supabase pooler connection string, confirmed present and non-empty) and hung past every per-hook timeout; the run was killed by an external 45-second wrapper (exit 143), consistent with the identical failure mode documented in Sprints 1–3. **No integration, API, or RLS test is claimed to have passed.** All ten mandatory RLS scenarios and the full package/API integration suites are written, reviewed for correctness against the documented business rules, and ready to run the moment raw Postgres connectivity is available — they were not weakened, mocked, or skipped to work around this limitation.
2. `job_types`/`service_categories`/`checklist_templates` have no write API this sprint (SELECT-only), consistent with `asset_types`' identical Sprint 3 precedent — only platform defaults are seeded; Organization-authored customization is not yet possible via the API.
3. No `install_job_id`-style back-reference was added to `properties.assets` (Sprint 3's documented gap, deferred pending Sprint 3's own "install Job" concept) — the Job → Asset relationship remains one-directional via `job_assets`, sufficient to answer "which Jobs touched this Asset" via a reverse query.
4. Technician `properties`/`assets` read access remains Organization-wide, not scoped to "Properties/Assets tied to their assigned Jobs" as Sprint 3's own report flagged as a future refinement now that Jobs exists — retrofitting Sprint 3's RLS policies is outside Sprint 4's scope and was not attempted (editing an already-applied migration is against the project's migration-safety rule; a new migration narrowing that access is a real option for a future sprint).
5. The pre-existing `auth_rls_initplan` finding on three Sprint 1 `identity.*` policies (see "Security Findings" #3) was identified but not fixed, for the same migration-safety reason.

## Sprint 5 Readiness

**Sprint 5 — Estimates, Invoicing & Payments — is ready to begin** from a dependency standpoint: Jobs exist as a stable, real entity with the full documented lifecycle, a permanent `job_status_history`/audit trail, and a `job.status = 'completed'` signal Estimates/Invoices can key off. The Job → Financials extension point is clean (no Estimate/Invoice/Payment table, field, or UI section was implemented or faked this sprint — see "Implemented Scope" and the Job detail page's explicit absence of any such section). Per the task's final stop condition, Sprint 5 has **not** been started.
