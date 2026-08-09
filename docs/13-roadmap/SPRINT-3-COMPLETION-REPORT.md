# Sprint 3 Completion Report

## Status

**Complete**, with the same category of execution-environment caveat carried over from Sprints 0–2 (see "Known Limitations" #1) and one deliberately documented divergence from the Properties permission model for Assets (see "Deviations From Documentation"). No undocumented scope was added; Jobs/scheduling/estimates/invoices/inventory/marketplace/AI/portal features were not touched.

## Executive Summary

Sprint 3 implements Properties & Assets: a trade-agnostic `properties` Postgres schema (`properties`, `buildings`, `rooms`, `property_customer_associations`, `assets`, `asset_types`) live on the real "Atlas Project" Supabase project, with RLS, audit triggers, and full-text/trigram search, built on top of Sprint 1's identity/organization and Sprint 2's CRM infrastructure — not competing with either. Two packages, `@atlas/properties` and `@atlas/assets`, jointly implement the single "properties" architectural module documented in `component-architecture.md` (see "Architecture Decisions"). They cover the documented lifecycle: Property creation with automatic default-Building provisioning for single-family homes, duplicate-address detection (hard-blocking, per `properties-prd.md` §16), Building/Room hierarchy, time-bounded Property↔Customer associations (never duplicating Customer PII onto Properties), and Asset creation/status-lifecycle/replace-flow scoped to a Property (optionally to a Building/Room) with cross-tenant attachment rejected at the application layer *and* the database layer. `apps/web` exposes this via 16 `/api/v1/` routes and a minimal, real staff UI (Properties list/detail, Asset detail) that deliberately does not fake Jobs/service-history functionality. 27 new tests were written (13 unit, all passing; 8 integration test files — 6 package-level `@atlas/properties`/`@atlas/assets` suites plus 2 API-route suites — covering the ten mandatory RLS/tenant-isolation scenarios, the full lifecycle, and the Role-permission matrix; real, not mocked, but blocked from executing in this sandbox by the same lack-of-raw-Postgres-TCP limitation documented in Sprints 0–2). One genuine pre-existing security regression from Sprint 1 (`uuid_generate_v7()`'s search-path hardening silently broke its own internal function call) was discovered and fixed. One legitimate performance-advisor finding (an unindexed foreign key) was found and fixed after the initial migration batch.

## Implemented Scope

Per `docs/06-modules/properties-prd.md`, `docs/06-modules/assets-prd.md`, `docs/03-domain/properties.md`, `docs/03-domain/buildings.md`, `docs/03-domain/rooms.md`, `docs/03-domain/assets.md`:

- Property creation (address, type, access notes), retrieval, listing, update, search, archive (soft-delete, blocked while active Buildings/Assets exist), restore.
- Automatic default-Building provisioning ("Main House") for `residential_single_family` Properties only, per `buildings.md` business rule 1; no default Building for multi-unit/commercial.
- Duplicate-Property detection at creation (address-line-1 similarity + exact postal-code match), hard-blocking unless explicitly acknowledged (`properties-prd.md` §16) — deliberately stricter than CRM's soft, non-blocking duplicate flag (Sprint 2), because the two PRDs specify different behaviors.
- Building CRUD nested under a Property; Room CRUD nested under a Building; both soft-deletable, both blocked from deletion while active children exist.
- Property↔Customer relationship via a separate `property_customer_associations` join table with `effective_from`/`effective_to` (never a `customer_id` column on `properties`, never duplicated Customer name/email/phone), enforcing "one current Customer per Property" via a partial unique index; add/end association lifecycle, full association history.
- Asset creation scoped to a Property, optionally to a Building and/or Room (Room requires a Building); identification fields only (manufacturer, model, serial number, install date) — no invented equipment-database fields, no per-trade tables.
- Asset status lifecycle: `active` → `removed`/`decommissioned` only, one-way, terminal (`assets.md` business rules 2–3); replace-Asset flow (mark old `removed`, create new Asset) retains both records, per `assets-prd.md` §18.
- Trade-agnostic, Organization-scoped `asset_types` catalog with platform defaults (`organization_id IS NULL`), read-only via API, seeded with 9 platform defaults (3 plumbing/HVAC/electrical each) — no hard-coded per-trade tables.
- Full-text (`tsvector`/GIN) + trigram (`pg_trgm`) search across Property address lines and Asset manufacturer/model/serial fields.
- Cursor-based pagination, filtering (`property_type`, `property_id`, `status`), and sorting on collection endpoints, per `docs/05-api/pagination.md`/`filtering.md`/`sorting.md`.

Not implemented (explicitly out of scope, confirmed absent from the diff): jobs, work orders, scheduling, dispatch, technician workflows, estimates, invoices, payments, inventory, supplier marketplace, manufacturer integrations, financing, AI diagnostics, predictive maintenance, property intelligence analytics, IoT integrations, customer portals.

## Domain Changes

### Properties

New `@atlas/properties` package, mirroring `@atlas/crm`'s domain/application/infrastructure layering:

- **Domain**: `default-building.ts` (`shouldProvisionDefaultBuilding` — true only for `residential_single_family`), `duplicate-detection.ts` (`isPotentialDuplicateAddress`, threshold-based, AND-combined address-similarity + postal-code match — stricter than CRM's OR-based flag), `errors.ts` (`NotFoundError`, `ForbiddenError`, `PropertyHasActiveRecordsError`, `BuildingHasActiveRecordsError`, `RoomHasActiveRecordsError`, `PossibleDuplicatePropertyError`).
- **Application**: `createProperty` (permission check → duplicate check → insert → conditional default-Building → optional initial Customer association), `getProperty`/`listProperties`/`searchProperties`/`updateProperty`/`archiveProperty`/`restoreProperty`, `getPropertyHistory` (Assets only; `jobs: []` always, documented limitation), `addCustomerAssociation`/`endCustomerAssociation`/`listCustomerAssociations`, `createBuilding`/`updateBuilding`/`archiveBuilding`/`restoreBuilding`, `createRoom`/`updateRoom`/`archiveRoom`/`restoreRoom`.
- **Infrastructure**: Drizzle-backed queries against `properties.properties`/`buildings`/`rooms`/`property_customer_associations`, plus a direct raw-SQL read against `properties.assets` (`asset-history.ts`, `hasActiveChildrenForProperty`/`hasActiveChildrenForBuilding`) — see "Architecture Decisions" for why this crosses the package boundary legitimately.

### Assets

New `@atlas/assets` package, same layering:

- **Domain**: `lifecycle.ts` (`canTransitionAssetStatus` — only `active` → `removed`/`decommissioned`; no-op and reverse transitions rejected), `errors.ts` (`NotFoundError`, `ForbiddenError`, `InvalidAssetStateError`).
- **Application**: `createAsset` (verifies Property, then Building-belongs-to-Property, then Room-belongs-to-Building, then asset-type visibility, before inserting), `getAsset`/`listAssets`/`searchAssets`/`updateAsset`/`transitionAssetStatus`/`archiveAsset`/`restoreAsset`/`getAssetHistory` (`jobs: []` always, documented limitation), `listAssetTypes`.
- **Infrastructure**: Drizzle-backed queries against `properties.assets`/`asset_types`, plus a direct raw-SQL read against `properties.properties`/`buildings`/`rooms` (`property-links.ts`) — the Asset half of the same cross-package pattern.

### Relationships

- **Property → Organization**: `organization_id` FK, RLS-enforced, matches Sprint 1's ownership pattern exactly.
- **Property → Customer**: indirect, via `property_customer_associations` (many-to-many over time, one current association enforced by a partial unique index), never a direct FK on `properties`. This is the one place `@atlas/properties` legitimately depends on `@atlas/crm` (documented in `component-architecture.md`'s module table); added `findCustomerForOrganization` to `@atlas/crm`'s public exports for this cross-module call.
- **Building → Property**, **Room → Building**: direct FK, both also carry a denormalized `organization_id` (matching the existing `contacts.organization_id` precedent from Sprint 2) so RLS policies can filter without a join.
- **Asset → Property** (required), **Asset → Building** (optional), **Asset → Room** (optional, requires Building): direct FK to each; `roomId` set without `buildingId` is rejected at the application layer (`create-asset.ts`/`manage-asset.ts`) — never just filtered out client-side.
- **Asset → AssetType**: direct FK; type must be visible to the Organization (platform default or the Organization's own) or Asset creation/update is rejected.

## Database Changes

New `properties` Postgres schema, 6 tables:

| Table | Purpose | Key columns |
|---|---|---|
| `properties` | The physical/legal Property, distinct from both Customer and Asset — `docs/03-domain/properties.md` | `id`, `organization_id`, `property_type` (enum), `address_line1/2`, `city`, `state`, `postal_code`, `access_notes`, `search_vector` (generated), `deleted_at`, timestamps |
| `buildings` | Structures on a Property — `docs/03-domain/buildings.md` | `id`, `organization_id`, `property_id`, `building_type` (enum), `name`, `deleted_at`, timestamps |
| `rooms` | Spaces within a Building — `docs/03-domain/rooms.md` | `id`, `organization_id`, `building_id`, `room_type` (enum), `name`, `deleted_at`, timestamps |
| `property_customer_associations` | Time-bounded Property↔Customer relationship | `id`, `organization_id`, `property_id`, `customer_id`, `effective_from`, `effective_to` (NULL = current), timestamps |
| `assets` | Physical equipment at a Property — `docs/03-domain/assets.md` | `id`, `organization_id`, `property_id`, `building_id`, `room_id`, `asset_type_id`, `status` (enum), `manufacturer_name`, `model_number`, `serial_number`, `install_date`, `notes`, `search_vector` (generated), `deleted_at`, timestamps |
| `asset_types` | Trade-agnostic type catalog, Organization-scoped with platform defaults | `id`, `organization_id` (nullable), `trade_type_id`, `name`, `is_active`, timestamps |

4 enums: `property_type` (`residential_single_family`, `residential_multi_unit`, `commercial`), `building_type` (`main`, `detached_garage`, `outbuilding`, `unit`), `room_type` (`kitchen`, `bathroom`, `utility`, `attic`, `basement`, `garage`, `other`), `asset_status` (`active`, `removed`, `decommissioned`).

### Constraints

- 14 FKs: every table's `organization_id` → `org.organizations.id`; `buildings.property_id` → `properties.id`; `rooms.building_id` → `buildings.id`; `property_customer_associations.property_id` → `properties.id` and `.customer_id` → `crm.customers.id` (cross-schema, matching Sprint 2's precedent); `assets.property_id`/`building_id`/`room_id`/`asset_type_id` → their respective tables; `asset_types.trade_type_id` → `reference.trade_types.id`.
- 2 uniqueness constraints, both scope-exact per the documented model, not assumed-global: `uq_property_customer_associations_current` — a **partial** unique index on `property_id` `WHERE effective_to IS NULL` (one current Customer per Property, not one Customer per Property ever); `uq_asset_types_org_trade_name` — unique on `(organization_id, trade_type_id, name)`, so the same type name can exist once per Organization per trade (and once among platform defaults), not globally.
- All 6 tables: `NOT NULL` on `organization_id` and every required relationship FK; `deleted_at` soft-deletion column (no hard DELETE — RLS default-denies it); `created_at`/`updated_at` timestamps.

### Indexes

20 total, none blind — each maps to a real ownership, relationship, search, or status-filter need:
- Ownership/listing: `idx_properties_organization_id_deleted_at`, `idx_buildings_organization_id`, `idx_rooms_organization_id`, `idx_assets_organization_id`, `idx_pca_organization_id`.
- Relationship (parent lookups): `idx_buildings_property_id`, `idx_rooms_building_id`, `idx_assets_property_id`, `idx_assets_building_id`, `idx_assets_room_id`, `idx_assets_asset_type_id` (added in migration 0014, see "Security Findings"), `idx_asset_types_trade_type_id`.
- Association-history lookups: `idx_pca_property_id_effective_to`, `idx_pca_customer_id_effective_to` (both composite, matching the "current association" query pattern).
- Status filtering: `idx_assets_status` (composite `organization_id, status`, matching the tenant-scoped list-by-status query shape).
- Search: `idx_properties_search_vector`/`idx_assets_search_vector` (GIN, `tsvector`), `idx_properties_address_line1_trgm`/`idx_assets_serial_number_trgm` (GIN, `pg_trgm`).
- The 2 uniqueness indexes listed above also serve as the lookup path for "does a current association exist" / "does this type name already exist" checks.

### Migrations

6 new migrations, all applied to the live "Atlas Project" Supabase project (`ucshfbwuoiohmkofqwte`) and verified via `list_migrations`/`execute_sql`:

| Migration | Purpose |
|---|---|
| `0009_properties_and_assets.sql` | Schema, 4 enums, 6 tables, 14 FKs, 2 unique indexes |
| `0010_properties_rls_search_and_audit.sql` | Search-vector generated columns, 17 indexes, RLS enable+force on all 6 tables, SELECT/INSERT/UPDATE policies, audit triggers on 5 tables (not `asset_types`, which is read-only reference data with no per-row audit trail) |
| `0011_properties_technician_assets_write.sql` | Grants Technician `assets:write` (see "Deviations From Documentation") |
| `0012_fix_uuid_generate_v7_search_path.sql` | Security fix, see "Security Findings" |
| `0013_properties_seed_asset_types.sql` | Seeds 9 platform-default `asset_types` rows |
| `0014_properties_security_advisor_fixes.sql` | Adds `idx_assets_asset_type_id`, see "Security Findings" |

No previously applied migration (0000–0008) was modified; every change is a new migration, per the task's git-safety/migration rules. `packages/database/migrations/meta/_journal.json` and the corresponding snapshot files were updated for each.

## RLS and Tenant Isolation

RLS is `ENABLE`d and `FORCE`d on all 6 new tables (FORCE matters because Owners/service roles could otherwise bypass RLS as the table owner). Policies follow the existing Atlas pattern (`app.current_user_has_permission(organization_id, resource, action)`):

- `properties`, `buildings`, `rooms`, `property_customer_associations`: gated on the `properties` resource (`read` for SELECT, `write` for INSERT, `write` OR `delete` for UPDATE — soft-delete is an UPDATE).
- `assets`: gated on the `assets` resource, same read/write/delete shape.
- `asset_types`: SELECT-only policy (`properties` OR `assets` read permission — either module's readers can see the catalog); no INSERT/UPDATE policy exists, so no non-service-role actor can write to it (`asset_types` is platform/Organization-admin data, not a Sprint-3-exposed write surface).

Indirect ownership (Asset → Property → Customer → Organization) is handled by each table carrying its own `organization_id` and RLS checking that column directly — not by relying on a join through the parent at query time. This means a row is provably tenant-isolated even if the parent-relationship FK were somehow wrong, which is the DB-level half of the "prevent cross-org association" requirement; the application layer (`create-asset.ts`'s `propertyExistsForOrganization`/`buildingExistsForProperty`/`roomExistsForBuilding`, `create-property.ts`'s `findCustomerForOrganization`) is the other half, verifying the *relationship itself* is intra-tenant before the FK is ever written.

### The ten mandatory RLS/tenant-isolation scenarios

All ten are written as real, non-mocked integration tests against the live Postgres database (not executed in this environment — see "Known Limitations" #1):

1. Tenant A cannot access Tenant B's Properties (get/list/create) — `properties/tenant-isolation.test.ts`.
2. Tenant A cannot access Tenant B's Assets (get) — `assets/tenant-isolation.test.ts`.
3. Cross-tenant Asset-to-Property attach rejected, both directions (Org B actor attaching to Org A's Property; Org A actor attaching to Org B's Property) — `assets/tenant-isolation.test.ts`.
4. Cross-tenant Property-to-Customer association rejected — `properties/tenant-isolation.test.ts`.
5. Unauthorized role mutation rejected (Dispatcher/Technician/Accountant/Owner matrix, both packages) — `properties/permission-matrix.test.ts`, `assets/permission-matrix.test.ts`.
6. Audit events created correctly for Property creation, scoped to the owning Organization only — `properties/tenant-isolation.test.ts`.
7. Audit events created correctly for Asset creation, scoped to the owning Organization only — `assets/tenant-isolation.test.ts`.
8. FKs prevent invalid relationships (Asset referencing a non-existent Property, inserted directly via `withServiceContext` to bypass the application layer and prove the DB constraint itself holds) — `assets/tenant-isolation.test.ts`.
9. Uniqueness constraints behave as documented (duplicate `(organization_id, trade_type_id, name)` `asset_types` row rejected at the DB level) — `assets/tenant-isolation.test.ts`.
10. `FORCE ROW LEVEL SECURITY` holds under a direct-table-select from an unrelated actor context (both Properties and Assets) — both `tenant-isolation.test.ts` files.

## Permissions

No new permissions were created. `identity.permissions` already carried `properties:read/write/delete` and `assets:read/write/delete` from Sprint 1's upfront platform catalog seed (`0002_seed_platform_data.sql`), reused exactly as-is. The only new `role_permissions` mapping is Technician → `assets:write` (migration `0011`), documented in "Deviations From Documentation". All other role grants (Owner/Admin: full; Dispatcher: read/write, not delete; Technician: `properties:read` only, `assets:read`+`assets:write`; Accountant: read-only both) fall out of the pre-existing Sprint 1 role-permission seed with no changes needed.

## API Endpoints

16 new routes under `/api/v1/`, all resolving the authenticated user, resolving org context from a query/body parameter (never trusting a client-asserted org switch), checking permission, validating input with Zod, executing through the application layer, and returning the standard envelope:

- `GET/POST /api/v1/properties`
- `GET/PATCH/DELETE /api/v1/properties/{id}`
- `POST /api/v1/properties/{id}/restore`
- `GET /api/v1/properties/{id}/history`
- `GET/POST /api/v1/properties/{id}/customer-associations`
- `DELETE /api/v1/properties/{id}/customer-associations/{associationId}`
- `GET/POST /api/v1/properties/{id}/buildings`
- `GET/PATCH/DELETE /api/v1/buildings/{id}`
- `GET/POST /api/v1/buildings/{id}/rooms`
- `GET/PATCH/DELETE /api/v1/rooms/{id}`
- `GET/POST /api/v1/assets`
- `GET/PATCH/DELETE /api/v1/assets/{id}`
- `POST /api/v1/assets/{id}/restore`
- `GET /api/v1/assets/{id}/history`
- `POST /api/v1/assets/{id}/decommission`
- `GET /api/v1/asset_types`

Only these documented resources were implemented; the task's own illustrative resource list was treated as non-authoritative, per instructions. `apps/web/lib/route-handler.ts` now chains `mapPropertiesError`/`mapAssetsError` into the existing error pipeline (404/403/409/422 mapping); new snake_case serializers/DTOs (`properties-serializers.ts`, `assets-serializers.ts`, `properties-types.ts`, `assets-types.ts`) match the established Sprint 2 pattern.

## UI

Three pages, matching Sprint 2's minimal-but-real approach — no generic CRUD admin panel, no faked Jobs/scheduling functionality:

- `apps/web/app/properties/page.tsx` — Property list + create form.
- `apps/web/app/properties/[id]/page.tsx` — address/access-notes, current-Customer + add-association form, Building/Room tree + add-Building form, Asset list grouped by location + add-Asset form, service-history timeline (Assets only — explicit "Jobs will appear here once implemented" note, not a fake Jobs section).
- `apps/web/app/assets/[id]/page.tsx` — identification fields, status/decommission control, an explicit "Job history will appear here once the Jobs module is implemented" placeholder rather than any faked job data.

## Audit Logging

Reused the existing `app.record_audit_event()` generic trigger exactly as Sprint 1/2 established it — no second audit mechanism. `CREATE TRIGGER audit_*` was added on `properties`, `buildings`, `rooms`, `property_customer_associations`, and `assets` (5 of the 6 new tables). `asset_types` was deliberately excluded: it is Organization/platform reference data written only via seed migrations and (in a future phase) admin tooling, not a per-request mutation surface this sprint exposes, so there is nothing routine to audit. `entity_type` for audit rows on these tables is `TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME` (confirmed by reading the Sprint 1 trigger definition), i.e. `properties.properties`, `properties.assets`, etc. — asserted directly in the tenant-isolation integration tests. No sensitive data beyond what the existing generic trigger already captures (old/new row JSON, actor, org, timestamp) is logged.

## Tests

### Unit Tests

13 new tests, domain-layer, no I/O — **executed, all passing**:
- `@atlas/properties`: `default-building.test.ts` (4 tests), `duplicate-detection.test.ts` (3 tests).
- `@atlas/assets`: `lifecycle.test.ts` (6 tests).

### API Tests

2 new integration test files (`apps/web/app/api/v1/properties/route.integration.test.ts`, `.../assets/route.integration.test.ts`) covering POST creation (including default-Building auto-provisioning, 404 on cross-tenant/nonexistent references, 422 on invalid payload) and GET listing (pagination envelope, 400 on missing `organization_id`) — real, against the live database, **not executed** in this sandbox (see "Known Limitations" #1).

### Integration Tests

6 new package-level integration test files:
- `@atlas/properties`: `tenant-isolation.test.ts`, `property-lifecycle.test.ts`, `permission-matrix.test.ts`.
- `@atlas/assets`: `tenant-isolation.test.ts`, `asset-lifecycle.test.ts`, `permission-matrix.test.ts`.

Real, against the live database, **not executed** in this sandbox (see "Known Limitations" #1).

### Security Tests

The ten mandatory RLS/tenant-isolation scenarios listed under "RLS and Tenant Isolation" are implemented as real assertions inside the integration test files above (not a separate suite) — **written and reviewed, not executed** in this sandbox.

## Validation Results

### Formatting

`pnpm run format` (Prettier, repo root) — **executed**, no files required reformatting; all Sprint 3 files were already correctly formatted.

### Lint

`pnpm turbo run lint` — **executed**, 17/17 packages passed, 0 warnings/errors (`--max-warnings 0` across every package including `@atlas/properties`, `@atlas/assets`, `@atlas/web`).

### Typecheck

`pnpm turbo run typecheck` — **executed**, 17/17 packages passed (`tsc --noEmit`).

### Tests

`pnpm turbo run test` — **executed**, 17/17 packages passed, 68 unit tests total (13 of which are new this sprint). This is the unit tier only; it excludes `src/integration/**` and `*.integration.test.ts` by Vitest config, consistent with Sprints 0–2.

### Build

`pnpm turbo run build` — **executed**, succeeded. `next build` compiled all 16 new API routes plus the 3 new UI pages, generated 14 static pages, and reported a clean production bundle (no build warnings surfaced).

## Security Findings

Reviewed via `mcp__Supabase__get_advisors` (`type: security` and `type: performance`) after the full Sprint 3 migration batch, per the mandatory post-migration security review.

1. **Fixed — pre-existing regression, not introduced this sprint, but first exercised by Sprint 3's seed migration.** `public.uuid_generate_v7()` had `SET search_path = ''` applied during Sprint 1's own security hardening (migration `0003`), which broke its internal unqualified call to `gen_random_bytes(10)` (the function silently could not resolve `gen_random_bytes` with an empty search path). This would have broken every real INSERT relying on the UUID default across the entire application since Sprint 1, and was only caught because `0013_properties_seed_asset_types.sql` was the first migration in this session to actually invoke a default-UUID INSERT and get a real error. Fixed in `0012_fix_uuid_generate_v7_search_path.sql` by fully-qualifying the call to `extensions.gen_random_bytes(10)`. Verified via a direct `execute_sql` call returning a valid UUID after the fix.
2. **Fixed.** Performance advisor flagged `properties.assets.asset_type_id` (FK to `asset_types`) as unindexed. Fixed in `0014_properties_security_advisor_fixes.sql` by adding `idx_assets_asset_type_id`; re-ran the advisor afterward and confirmed the finding no longer appears.
3. **Reviewed, not new, no action taken.** Security advisor also reported `rls_enabled_no_policy` (INFO) on 13 `platform.audit_events_*` monthly partition tables, and `SECURITY DEFINER`-callable-by-`anon`/`authenticated` (WARN) on `public.rls_auto_enable()`. Both are pre-existing platform infrastructure from Sprint 1 — the partition tables inherit policies from the parent `platform.audit_events` table (expected Postgres partitioning behavior, not a gap), and `rls_auto_enable()` is Sprint 1's own DDL-event-trigger helper, unrelated to any table this sprint created. Neither was introduced by, nor is remediable within, Sprint 3's scope; no `properties.*` table produced any advisor finding of its own after the two fixes above.
4. All `properties.*`/`assets.*` unique/composite indexes flagged as "unused" by the performance advisor were reviewed and are expected noise — these are brand-new tables with zero production query traffic in this development project, not a sign of a wrong index choice.

## Documentation Changes

- Added `docs/13-roadmap/sprint-3.md` (Sprint 3 plan, authored before implementation per the task's read-first requirement).
- Added this completion report.
- No existing documentation was rewritten; no contradiction was found between `properties-prd.md`/`assets-prd.md`/the domain docs and the database/API docs that required a documentation fix or a new ADR beyond the two-packages/one-module note captured in "Architecture Decisions" (which is an implementation-organization clarification, not a change to any documented business rule).

## Architecture Decisions

`docs/02-architecture/component-architecture.md`'s module-responsibility table defines exactly **one** architectural module, "properties," owning `properties`, `buildings`, `rooms`, and `assets` together. Sprint 0 had already scaffolded these as **two** separate TypeScript packages, `@atlas/properties` and `@atlas/assets`. Rather than either merging the packages (a large, out-of-scope refactor of prior sprints' work) or splitting the architecture doc's module in two (a real, undocumented architecture change), this sprint resolved the tension by treating both packages as jointly implementing that single documented module: either package's infrastructure layer may query any of the four `properties`-schema tables directly (`@atlas/properties`'s `asset-history.ts` and active-children checks query `assets` directly; `@atlas/assets`'s `property-links.ts` queries `properties`/`buildings`/`rooms` directly), while genuinely separate modules (`crm`, and future `jobs`) continue to go through each package's public `index.ts` exports only — the module-boundary rule is preserved at the *module* level, just not at the *package* level for this one pre-existing package split. This is documented inline in both `packages/properties/src/index.ts` and `packages/assets/src/index.ts`. No ADR was written for this because it does not change any documented business rule, database structure, or external contract — it is purely an internal code-organization reading of an already-approved document, reversible without any data or API migration.

## Deviations From Documentation

One deliberate, documented divergence:

- **Technician gets `assets:write`, but only `properties:read`.** `docs/03-domain/roles.md`'s module-summary table gives Technician a single "Customers/Properties: R (assigned only)" row with no separate Assets entry, which Sprints 1–2 applied uniformly (Technician was `assets:read`-only, same as Properties). `docs/06-modules/assets-prd.md`'s Personas and Permission Requirements sections are more specific and postdate that summary table in specificity: Technicians are named as the primary field creator/updater of Assets ("Same as parent Property — Technicians can create/update Assets on Properties tied to their assigned Jobs"). Since `assets-prd.md` is the more specific, Asset-specific source and does not contradict `roles.md` so much as add detail `roles.md` never captured for Assets specifically, Technician was granted `assets:write` (migration `0011`) while Properties themselves remain Technician-read-only, matching `properties-prd.md` §12 exactly. The "scoped to assigned Jobs" qualifier in `assets-prd.md` is **not** enforced — Jobs does not exist until Sprint 4, so Technician's `assets:write` is currently Organization-wide-scoped like every other role's grant, not Job-scoped. This mirrors the same kind of deferral already accepted for Technician's `customers:read` grant in Sprint 2.

No other deviation was found; where the domain docs, database docs, and API docs disagreed on a design question (Property↔Customer cardinality, Property address model, duplicate-detection strictness, Asset identification fields), the more specific/authoritative document was followed and no contradiction required a stop-and-report per the task's decision criteria.

## Known Limitations

1. **Integration and API tests could not be executed in this environment.** As in Sprints 0–2, this sandbox has no raw Postgres TCP egress to the live Supabase database outside of the MCP tool bridge. `pnpm test:integration` for `@atlas/properties` was attempted against the real `DATABASE_URL` from `.env.local` and hung past every per-hook timeout: `property-lifecycle.test.ts`'s `beforeAll` alone ran over 20 seconds before the file reported "6 tests | 6 skipped," and `tenant-isolation.test.ts`'s own `beforeAll` stalled in the same way; the run was ultimately killed by an external 40-second wrapper (exit code 124). This is consistent with, though slower than, the clean single "Hook timed out in 10000ms" failure documented in Sprints 1–2 — likely because Vitest's `fileParallelism: false` setting causes the per-file connection-hang time to compound across sequential files. **No integration or RLS test is claimed to have passed.** All ten mandatory RLS scenarios and the full package/API integration suites are written, reviewed for correctness against the documented business rules, and ready to run the moment raw Postgres connectivity is available (e.g., in CI or a developer's local machine) — they were not weakened, mocked, or skipped to work around this limitation.
2. Asset/Property "service history" (`getPropertyHistory`/`getAssetHistory`) always returns an empty `jobs` array, since Jobs does not exist until Sprint 4. This is surfaced honestly in the UI ("Job history will appear here once the Jobs module is implemented") rather than hidden or faked.
3. Technician's `assets:write` grant is Organization-wide, not scoped to "assets on Properties tied to the Technician's assigned Jobs" as `assets-prd.md` describes, because Jobs/assignment does not exist yet (see "Deviations From Documentation").
4. `asset_types` has no write API this sprint (SELECT-only), consistent with it being platform/Organization-admin reference data rather than a per-request Sprint-3 mutation surface; if per-Organization custom Asset types need to be creatable via the API in a future sprint, that will need its own permission/route design.

## Sprint 4 Readiness

The Property and Asset domain, database schema, RLS policies, and API surface are stable and ready for Sprint 4 (Jobs/scheduling) to build on: Assets already carry a `property_id`/`building_id`/`room_id` location and an `organization_id` ownership path that a future `jobs` table can reference by FK exactly like `buildings`/`rooms`/`assets` do today, and `getPropertyHistory`/`getAssetHistory`'s empty `jobs: []` arrays are the documented seam where Sprint 4 will plug in real data.

**SPRINT 3 IS THE ONLY IMPLEMENTATION AUTHORIZED IN THIS TASK. SPRINT 4 HAS NOT BEEN STARTED.**
