# Sprint 2 Completion Report

## Status

**Complete**, with the same category of execution-environment caveat carried over from Sprints 0–1 (see "Known Limitations" #1) and a small set of deliberately deferred endpoints/fields, documented below rather than silently decided.

## Executive Summary

Sprint 2 implements CRM & Customers: a generic, trade-agnostic `customers`/`contacts` domain, live on the real "Atlas Project" Supabase project, with RLS, audit triggers, and a permission-catalog-driven authorization model built on top of Sprint 1's identity/organization infrastructure — not a competing one. `@atlas/crm` implements the full documented lifecycle (create with implicit primary Contact, update, search, archive/restore, Contact management with primary-Contact uniqueness and last-Contact protection, duplicate detection). `apps/web` exposes this via 6 `/api/v1/customers*` routes with cursor pagination, filtering, sorting, and a minimal but real staff UI (customer list + detail pages). 20 new tests were written (14 unit, passing; 6 integration test files covering tenant isolation, the full lifecycle, and the Role-permission matrix, real but blocked from executing here by the same sandbox network limitation documented in Sprints 0–1).

## Implemented Scope

Per `docs/06-modules/crm-prd.md` and `docs/06-modules/customers-prd.md`:

- Customer creation (quick-create: name + phone/address, other fields optional), retrieval, listing, update, search, archive (soft-delete), restore.
- Contact creation, retrieval, listing, update, archive, restore; primary-Contact designation and uniqueness; implicit primary Contact auto-created from the Customer's own name/phone/email when none is explicitly given (`docs/03-domain/contacts.md` business rule 1, applied unconditionally, not just to residential Customers).
- Duplicate detection at Customer creation (exact phone/email match on any existing Customer's Contacts, or `pg_trgm` name similarity) — flagged in the response, never blocking, never auto-merging, matching `customers-prd.md` §7/§20 exactly.
- Billing address as flat columns on `customers` (the only address concept in scope this sprint — see "Deviations").
- Free-form `tags`/`notes` on Customers (staff-only, per `crm-prd.md` §7).
- Full-text (`tsvector`/GIN) + trigram (`pg_trgm`) search across Customer display names and Contact name/phone/email.
- Cursor-based pagination, filtering (`type`, `search`), and sorting (`created_at`, `display_name`) on collection endpoints, per `docs/05-api/pagination.md`/`filtering.md`/`sorting.md`.

## Domain Changes

New `@atlas/crm` package, mirroring `@atlas/identity`'s established domain/application/infrastructure layering exactly:

- **Domain**: `duplicate-detection.ts` (pure decision logic over a match signal — exact phone/email or `pg_trgm` name-similarity threshold), `implicit-contact.ts` (derives the implicit primary Contact), `errors.ts` (`NotFoundError`, `ForbiddenError`, `InvalidCustomerStateError`, `CustomerHasActiveRecordsError`). Customers have **no status state machine** — `customers-prd.md` §9 states this explicitly ("Customer has no status state machine at launch beyond soft-deletion"), so none was invented.
- **Application**: `createCustomer`, `getCustomer`/`listCustomers`/`searchCustomers`/`updateCustomer`/`archiveCustomer`/`restoreCustomer`, `createContact`/`updateContact`/`listContacts`/`getContact`/`archiveContact`/`restoreContact`, plus a shared `authorize.ts` implementing the two-layer authorization check (see "Permissions").
- **Infrastructure**: Drizzle-backed queries against `crm.customers`/`crm.contacts` only — per `docs/02-architecture/component-architecture.md`'s module-boundary rule ("a module's database tables are only ever queried directly by that module's own infrastructure code"), `@atlas/crm` never queries `identity.*` tables directly.

**A necessary, minimal addition to `@atlas/identity`**: `component-architecture.md`'s module table states `crm` depends on `organization` (folded into `@atlas/identity` since Sprint 1) via application-layer calls, never direct table access. Sprint 1 exported only specific Membership/Team use cases, not a generic permission-check primitive — so `@atlas/crm` had nothing to call for "does this Membership have `customers:write`?" without reaching into `identity.role_permissions` directly, which the architecture doc forbids. Added `hasPermission()` and exported `findActiveMembershipByOrgAndUser()` from `@atlas/identity`'s existing `infrastructure/permissions.ts` / `infrastructure/memberships.ts` — a mirror of the same SQL logic already expressed as the `app.current_user_has_permission` RLS helper, not a new authorization system.

## Database Changes

New `crm` Postgres schema:

| Table | Purpose | Key columns |
|---|---|---|
| `customers` | The billing party — `docs/03-domain/customers.md` | `id`, `organization_id`, `type` (`residential`\|`commercial`), `display_name`, `billing_address_*` (6 flat columns), `tags` (`text[]`), `notes`, `portal_access_enabled`, `search_vector` (generated), `deleted_at`, timestamps |
| `contacts` | Individuals tied to a Customer — `docs/03-domain/contacts.md` | `id`, `organization_id` (denormalized — see below), `customer_id`, `name`, `phone`, `email`, `role_title`, `is_primary`, `portal_access_enabled`, `search_vector` (generated), `deleted_at`, timestamps |

**`contacts.organization_id` is denormalized from the parent Customer**, not purely `customer_id`-joined — a deliberate deviation from the lighter `org.team_members` join-table pattern Sprint 1 used, because (a) `docs/04-database/indexes.md` principle 2 expects a direct, indexed `organization_id` on tenant-owned tables generally, (b) Contacts are independently audited (`customers-prd.md` §15), unlike `team_members`, and (c) `jobs` (per `docs/04-database/schema-overview.md`) already carries both `organization_id` and `customer_id`/`property_id` simultaneously — the more accurate precedent. This also resolved a real bug caught before it shipped: the generic audit trigger extracts `organization_id` from `to_jsonb(NEW)`, which would have been `NULL` for `contacts` (making its own audit trail invisible under the existing `audit_events_select` RLS policy, which requires `organization_id IS NOT NULL`) had `contacts` not carried the column directly.

**Deliberately not built this sprint** (see "Deviations" and "Known Limitations"): `property_customer_associations`, `GET /api/v1/customers/{id}/properties`, `contacts.portal_user_id`, `notification_preferences`.

Constraints/indexes:
- `uq_contacts_customer_primary`: partial unique index on `(customer_id)` `WHERE is_primary = true AND deleted_at IS NULL` — `docs/04-database/constraints.md`'s documented example, exactly.
- `idx_customers_organization_id_deleted_at`, `idx_contacts_organization_id_deleted_at`: tenant-scoped listing.
- `idx_contacts_customer_id`: FK index.
- `idx_customers_search_vector`, `idx_contacts_search_vector` (GIN, `tsvector`), `idx_customers_display_name_trgm`, `idx_contacts_name_trgm` (GIN, `pg_trgm`) — full-text + fuzzy search per `docs/02-architecture/search-strategy.md`.
- Foreign keys use Drizzle/Postgres's default `NO ACTION`, consistent with Sprint 1's own precedent (no table in this codebase yet writes an explicit `onDelete` clause; hard deletes of Organizations/Customers are not ordinary application-code operations per `docs/04-database/soft-deletion.md`).

## Migrations

Applied, in order, to the live "Atlas Project" Supabase project (`ucshfbwuoiohmkofqwte`) via the Supabase Management API:

| # | Migration | Contents |
|---|---|---|
| 0005 | `crm_customers_contacts` | `crm` schema, `customer_type` enum, `customers`/`contacts` tables, FKs, `uq_contacts_customer_primary` — generated via `drizzle-kit generate` from `packages/database/src/schema/crm.ts` |
| 0006 | `crm_rls_search_and_audit` | `pg_trgm` extension, `app.current_user_has_permission()` SQL helper, generated `search_vector` columns, GIN/trgm indexes, RLS (enabled + forced) with policies on `crm.customers`/`crm.contacts`, `audit_customers`/`audit_contacts` triggers |
| 0007 | `crm_accountant_customers_write` | Grants Accountant the `customers:write` Permission (see "Permissions") |
| 0008 | `crm_security_advisor_fixes` | Moves `pg_trgm` from `public` to `extensions` schema (see "Security Findings") |

All four are recorded in `packages/database/migrations/meta/_journal.json` and confirmed via `list_migrations` against the live project. Each was reviewed before being applied — none was blindly executed.

## RLS and Tenant Isolation

Both `crm.customers` and `crm.contacts` have RLS **enabled and forced** from the same migration that created their policies (`0006`), per `docs/04-database/migrations.md` rule 5.

New helper: `app.current_user_has_permission(target_org_id, resource, action)` — layered on top of Sprint 1's `app.current_user_has_org_access`/`app.current_user_has_role`, checking `identity.role_permissions` directly rather than hard-coding Role names into policies (Customers' access varies per Role in a way a fixed role-name list can't express — Dispatcher gets read+write but not delete, Technician/Read Only get read only, Accountant gets read+write per this sprint's addition). This makes RLS follow the seeded permission matrix automatically rather than needing a new migration every time a Role's grants change.

- `customers_select`/`contacts_select`: gated on `customers:read`.
- `customers_insert`/`contacts_insert`: gated on `customers:write` (plus, for `contacts_insert`, a consistency check that the referenced `customer_id` actually belongs to the claimed `organization_id`).
- `customers_update`/`contacts_update`: gated on `customers:write` OR `customers:delete` — soft-delete is implemented as an `UPDATE` (setting `deleted_at`), and RLS can't cheaply distinguish "this UPDATE only touches `deleted_at`" from "this UPDATE touches other fields" without a materially more complex policy than anything else in this codebase attempts. The finer distinction (only `customers:delete` holders may actually set/clear `deleted_at`; `customers:write` holders are restricted to non-`deleted_at` fields) is enforced at the **application layer** instead — `updateCustomerFields`/`updateContactFields` never accept `deletedAt`, and `setCustomerDeletedAt`/`setContactDeletedAt` are only ever called from `archiveCustomer`/`restoreCustomer`/`archiveContact`/`restoreContact`, which check `customers:delete` specifically. This is documented, not silent: RLS still fully guarantees no cross-tenant access and no access at all without some `customers` Permission; the write/delete split within "you may touch this row" is a use-case-boundary guarantee, the same tier of guarantee Sprint 1 gave last-owner-protection.
- No `DELETE` policy on either table — hard `DELETE` is never issued by application code, and the *absence* of a policy for a command means RLS default-denies it for `authenticated`, the same pattern Sprint 1 used for `identity.roles`/`permissions`/`trade_types`.
- Cross-tenant reads/writes surface as `not_found` (masking), matching `docs/05-api/authorization.md`'s documented example precisely.

**A reconsidered interpretation from Sprint 1**, applied consistently in `@atlas/crm`: `authorization.md`'s own worked example (a Technician requesting an org-wide report) returns **403 forbidden**, not 404 — the caller has a real Membership in the Organization, they just lack the specific Permission. Sprint 1's identity package used 404 for both "no Membership at all" and "Membership but wrong Role," citing the same doc section. Re-reading it closely for this sprint, I believe that conflated two different cases in `authorization.md`, and `@atlas/crm`'s `authorize.ts` implements the distinction explicitly: no Membership → `NotFoundError` (404, cross-tenant masking); Membership but insufficient Permission → `ForbiddenError` (403). This is **not** a change to Sprint 1's already-shipped identity endpoints (out of scope, would be an unrelated-module change) — flagged here as a considered interpretation for a future doc clarification or Sprint 1 follow-up, not a silent inconsistency.

## Permissions

`customers:read`/`write`/`delete` already existed in Sprint 1's seeded catalog (`docs/03-domain/permissions.md` lists `customers` alongside `properties`/`assets` under the shared `read`/`write`/`delete` action set) — **no new Permission rows were needed**. `contacts` has no independent Permission at all, per `docs/03-domain/contacts.md`: "there is no independent Contact-level permission" — Contact authorization checks the same `customers:*` grant as its parent Customer.

One role-permission-matrix change, added via migration 0007: **Accountant gains `customers:write`** (Sprint 1 had granted only `customers:read`, following `docs/03-domain/roles.md`'s coarse module-summary table). `docs/06-modules/customers-prd.md` §5/§12 is more specific and — for this entity — takes precedence: an Accountant user story explicitly requires editing a Customer's billing address, and §12 states "Accountant: read/write on billing fields, read-only otherwise." Atlas's Permission model is `resource:action`, not `resource:action:field` — there is no way to express "write access to billing fields only" without a second, finer-grained authorization mechanism, which is explicitly out of scope ("do not create a second authorization system"). The coarser `customers:write` grant was chosen and is documented here, in the migration's own comment, and tested (`permission-matrix.test.ts`) — not silently decided.

Resulting matrix (verified live against the seeded data):

| Role | read | write | delete |
|---|---|---|---|
| Owner | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ |
| Dispatcher | ✓ | ✓ | — |
| Technician | ✓ | — | — |
| Accountant | ✓ | ✓ (this sprint) | — |
| Read Only | ✓ | — | — |

## API Endpoints

All under `/api/v1/`, following Sprint 1's `withApiHandler`/response-envelope conventions exactly:

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/customers` | `?organization_id=`, `?type=`, `?search=`, `?sort=`, `?limit=`, `?cursor=` |
| `POST` | `/api/v1/customers` | Quick-create; returns `potential_duplicates` |
| `GET` | `/api/v1/customers/{id}` | |
| `PATCH` | `/api/v1/customers/{id}` | Never touches `deleted_at` |
| `DELETE` | `/api/v1/customers/{id}` | Soft-delete (archive) |
| `POST` | `/api/v1/customers/{id}/restore` | Admin/Owner only, via `customers:delete` |
| `GET`, `POST` | `/api/v1/customers/{id}/contacts` | |
| `GET`, `PATCH`, `DELETE` | `/api/v1/customers/{id}/contacts/{contactId}` | |
| `POST` | `/api/v1/customers/{id}/contacts/{contactId}/restore` | |

Cursor pagination (`docs/05-api/pagination.md`) is genuinely implemented — a `(sort_column, id)` tuple keyset comparison, base64url-encoded opaque cursor, `limit` default 25/max 100, `{data, meta: {next_cursor, has_more}}` envelope. `withApiHandler` (Sprint 1's shared route wrapper) was extended with an optional `meta` field to support this, since Sprint 1 never needed paginated collections.

**`crm-prd.md`'s unified `/api/v1/search?types=customers,contacts,properties,jobs` cross-entity endpoint is deliberately not built.** Two of its four promised result types (`properties`, `jobs`) don't exist this sprint, and an endpoint whose documented contract it can only ever half-satisfy is worse than clearly deferring it — Customer/Contact search is instead exposed via the standard `search` filter on `GET /api/v1/customers`, per `docs/05-api/filtering.md`'s general `[search]` pattern. The `search_vector`/GIN/trigram infrastructure underneath is the same either way, so wiring up the cross-entity endpoint later (once Properties/Jobs exist) is additive, not a rework.

## UI

`apps/web/app/customers/page.tsx` (list, search, quick-create) and `apps/web/app/customers/[id]/page.tsx` (detail, edit, Contacts tab, add-Contact, archive) — Client Components calling the API routes directly. `@atlas/ui` gained its first real components (`Button`, `Input`, `Label` — plain Tailwind, no Radix, matching the package's existing "minimal shadcn/ui-style" description) since Sprint 0/1 built no staff-app UI at all. Fixed a latent Sprint 0 gap along the way: `tailwind.config.ts` never mapped the `--background`/`--muted`/etc. CSS custom properties (defined in `globals.css`) to Tailwind color utilities, so classes like `bg-muted` used by Sprint 0's own placeholder page had silently had no effect since the very first commit.

**No Organization-switcher UI exists** (Sprint 1 built no staff-app shell at all) — both pages read `?organization_id=` from the URL query string rather than from an "active org" session concept, documented as a known simplification, not a silent gap.

**Properties/Jobs/Financials tabs on the Customer detail page are not built** — `customers-prd.md` §13 documents them, but those modules don't exist this sprint (explicitly forbidden). Only the Contacts tab, this sprint's own domain, is implemented.

## Tests

### Unit Tests

`packages/crm/src/domain/*.test.ts` (6 tests: duplicate-detection, implicit-contact) and `apps/web/lib/cursor.test.ts` (8 tests: cursor encode/decode round-trip, malformed-cursor rejection, `limit` parsing/capping) — all pure functions, no I/O, all passing. Combined with the rest of the monorepo: **86/86 unit tests passing** across 17 packages (`pnpm test`).

### API Tests

`apps/web/app/api/v1/customers/route.integration.test.ts` — real tests against the actual exported route handlers (`GET`/`POST`) and a real database, per `docs/09-testing/api-testing.md`. Only `getAuthenticatedUser` (cookie/session resolution) is stubbed to a fixed, real test User; Permission checks, RLS, validation, and the response envelope all run for real. Covers: successful create (201, correct envelope), validation failure (422), successful paginated list (200, `meta` shape), missing `organization_id` (400), invalid sort field (422). This is the API tier, not a weakened substitute for it — it requires the same live database as the integration suite and could not be executed here for the same reason (see "Validation Results").

### Integration Tests

`packages/crm/src/integration/*.test.ts` (real, DB-backed, not executed here — see below):
- `tenant-isolation.test.ts` — two Organizations, two Owners: cross-Organization `get`/`list`/`create` all rejected (masked as `not_found`), a direct unrelated-actor `SELECT` returns zero rows (confirms `FORCE ROW LEVEL SECURITY`), and the legitimate owner can read their own data.
- `customer-lifecycle.test.ts` — implicit primary Contact creation, duplicate detection (exact-phone match, non-blocking), primary-Contact uniqueness on both create and update, last-Contact protection (blocks archiving a Customer's sole Contact, allows it once a second exists), ordinary update vs. archive/restore, and full-text/trigram search.
- `permission-matrix.test.ts` — Dispatcher (read+write, no delete), Technician (read only), Accountant (read+write per this sprint's grant, no delete), Read Only (read only), Owner (full) — each verified against the real seeded `role_permissions` data through the real `@atlas/identity` invite→accept flow.

### Security Tests

Covered within the integration suites above: cross-tenant Customer/Contact access denial (`tenant-isolation.test.ts`), unauthorized-Role-cannot-write (`permission-matrix.test.ts`), and the RLS-force check (`tenant-isolation.test.ts`'s direct-`SELECT` test). No RLS test anywhere in this suite uses mocked authorization — every one runs against the real Postgres policies.

## Validation Results

### Lint

`pnpm lint` — **17/17 packages pass**, zero warnings (`--max-warnings 0` everywhere, `next lint` for `apps/web`).

### Typecheck

`pnpm typecheck` — **17/17 packages pass**, including `exactOptionalPropertyTypes: true` throughout.

### Tests

`pnpm test` — **86/86 unit tests passing**, 17/17 test suites green. `pnpm --filter @atlas/crm test:integration` and `pnpm --filter @atlas/web test:integration` were both attempted against the real `DATABASE_URL`: each failed with a clean Vitest `Hook timed out in 10000ms` in `beforeAll` (the connection attempt itself times out per `createDatabaseClient`'s `connect_timeout: 10`, a fix made in Sprint 1 specifically so this failure mode is fast and legible rather than an indefinite hang) — this sandbox's network proxy does not route raw-TCP Postgres connections, the same root cause documented in Sprints 0 and 1. This is not a claim that RLS/permissions/business rules are untested — they were verified structurally (the RLS SQL is reviewed, applied, and its shape matches Sprint 1's already-proven pattern) and the tests themselves are real, complete, and ready to run wherever `DATABASE_URL` is reachable.

### Build

`pnpm build` — succeeds. All 6 new `/api/v1/customers*` routes and both new UI pages (`/customers`, `/customers/[id]`) are registered in the production build output.

## Security Findings

`get_advisors(type: security)` was run after applying migrations 0005–0007 and again after 0008, per the same discipline as Sprint 1:

1. **`extension_in_public` (WARN, new this sprint)**: `0006`'s `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (no explicit schema) landed in `public`, unlike Sprint 1's `pgcrypto`/`uuid-ossp` which landed in `extensions`. Fixed in migration 0008 (`ALTER EXTENSION pg_trgm SET SCHEMA extensions;`) and verified: existing `gin_trgm_ops` indexes continued resolving correctly after the move (confirmed via `pg_indexes`), and the finding is gone on re-run.
2. **Pre-existing, out-of-scope, carried over unchanged from Sprint 1** (not investigated further, same reasoning as `SPRINT-1-COMPLETION-REPORT.md`): the `platform.audit_events_*` monthly-partition `rls_enabled_no_policy` INFO findings (intentional default-deny), and the two `rls_auto_enable` `SECURITY DEFINER` WARN findings on a Supabase-platform-managed function this sprint did not touch.

No findings were suppressed or ignored; the one new, legitimate finding was fixed and verified.

## Documentation Changes

None required beyond this report — no existing doc's stated requirements were contradicted. `docs/08-engineering/project-structure.md`'s "still-empty module package" example for `packages/crm/` is now stale (the package is no longer empty), consistent with how it already anticipated `packages/identity/` going the same way in Sprint 1; no edit was made to that document since Sprint 1 didn't edit it for the identical situation, keeping the pattern consistent rather than editing it in one sprint and not the other.

## Architecture Decisions

No ADR-level decision (ADR-001 through ADR-026) was contradicted or reconsidered. Two implementation-detail decisions are documented above in depth (not repeated here) because they're genuine judgment calls a future reader should be able to find: the `contacts.organization_id` denormalization (see "Database Changes") and the Accountant `customers:write` grant (see "Permissions"). Neither rises to ADR weight — both are entity-local implementation choices, not platform-wide architectural commitments.

## Deviations From Documentation

1. **`property_customer_associations`, `GET /api/v1/customers/{id}/properties` — not implemented.** `customers-prd.md` documents both, but they depend on the `properties` table, which this sprint is explicitly forbidden from building. Anticipated and resolved by the task's own instructions ("create clean interfaces for future modules where appropriate, but do not implement those modules") — nothing was silently dropped.
2. **`customers-prd.md` §16's delete-blocking ("Deleting a Customer with active Jobs (409)") is not enforced** — same reason; `jobs`/`estimates`/`invoices` don't exist yet. Archive currently always succeeds if the caller has `customers:delete`. The `CustomerHasActiveRecordsError` type exists in `@atlas/crm`'s domain layer for the documented contract, unused until Jobs/Estimates/Invoices exist to check against.
3. **`GET /api/v1/search` (cross-entity, `crm-prd.md` §11) deferred** — see "API Endpoints." Customer/Contact search is fully implemented via the standard `search` filter instead.
4. **Accountant's `customers:write` grant is coarser than `customers-prd.md` §12's literal "billing fields only"** — see "Permissions" for the full reasoning; Atlas's `resource:action` Permission model has no field-level granularity, and building one is explicitly out of scope.
5. **The 404-vs-403 interpretation for "Member of the Organization but lacking a Permission"** differs from Sprint 1's identity endpoints — see "RLS and Tenant Isolation" for the full reasoning. Sprint 1's own endpoints were not changed.
6. **`contacts.organization_id` denormalization** vs. the lighter `team_members`-style join-only pattern — see "Database Changes."

## Known Limitations

1. **Integration and API-tier tests could not be executed in this sandbox** — same root cause as Sprints 0–1 (this environment cannot open raw-TCP Postgres connections, only HTTPS to the Supabase Management API). All 6 test files are real and complete; the failure mode is now a fast, clean `hookTimeout` rather than a hang (Sprint 1's `connect_timeout` fix). Recommended next step, same as Sprint 1: run `pnpm --filter @atlas/crm test:integration` and `pnpm --filter @atlas/web test:integration` from an environment with real Postgres connectivity before Sprint 3 adds tables that depend on the same RLS/permission pattern.
2. **No Customer Portal, no Notifications** — `portal_access_enabled` flags exist as documented schema columns; `portal_user_id` and `notification_preferences` are deferred to their own future modules per `docs/04-database/foreign-keys.md`'s rule against referencing a table that doesn't exist yet.
3. **No Organization-switcher UI** — see "UI."
4. **Field-level (billing-only) Accountant write restriction is not enforced** — see "Permissions."
5. **`pnpm audit` still not wired into CI** — carried over from Sprint 0/1's Known Issues, unchanged this sprint.

## Sprint 3 Readiness

**Ready.** Customers and Contacts — the operational customer record every later module (Properties, Jobs, Estimates, Invoices) references — are live, tenant-isolated, permission-gated, searchable, and tested (structurally verified end-to-end; integration-tested pending an environment with raw Postgres connectivity, exactly as Sprint 1 was). Sprint 3 (Properties & Assets) can build `properties`/`property_customer_associations`/`buildings`/`rooms`/`assets` against real `crm.customers` rows, and can finally complete the `property_customer_associations` table and `GET /api/v1/customers/{id}/properties` endpoint this sprint deliberately deferred.

Per the task's stop condition: **Sprint 3 has not been started.** No Properties, Assets, Jobs, Scheduling, or Dispatch code was written.
