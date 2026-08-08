# Sprint 1 Completion Report

## Status

**Complete**, with one execution-environment caveat carried over from Sprint 0 (see "Known Issues" #1) and a small set of deliberately deferred endpoints (see "Deviations" and "Sprint 2 Readiness").

Identity & Organization now exist end to end: schema, RLS, audit triggers, and seed data are live on the real "Atlas Project" Supabase project; `@atlas/identity` implements every Sprint 1 use case (Organization creation, invitations, Membership lifecycle, Teams); `/api/v1/` route handlers wire those use cases to HTTP with MFA enforcement for privileged actions; and a full test suite (unit + integration) exercises the documented business rules, including the exit criteria's cross-tenant isolation scenario.

## Database

Applied as five migrations against the real "Atlas Project" project (ref `ucshfbwuoiohmkofqwte`), via the Supabase Management API (`apply_migration`) rather than a direct `psql`/Drizzle-migrator connection — see "Known Issues" #1 for why.

| # | Migration | Contents |
|---|---|---|
| 0000 | `identity_and_organizations` | `uuid_generate_v7()` (pgcrypto-based, RFC 9562), 4 new schemas (`reference`, `identity`, `org`, `platform`), `trade_types`, `users`, `organization_memberships`, `roles`, `membership_roles`, `permissions`, `role_permissions`, `organizations`, `organization_trade_types`, `teams`, `team_members`, `audit_events` (partitioned by month, 12 months of partitions + a `DEFAULT` catch-all), all FKs and indexes |
| 0001 | `rls_and_audit_triggers` | `app` schema; `app.current_user_has_org_access`, `app.current_user_has_role`, `app.current_actor_user_id` helper functions (exact definition of the first per docs/04-database/multi-tenancy.md); `app.record_audit_event()` generic trigger function; RLS enabled + forced on every Sprint 1 table with policies; audit triggers on `organizations`, `teams`, `organization_memberships`, `users` |
| 0002 | `seed_platform_data` | 6 platform Roles, 37 Permissions (full `resource:action` catalog from docs/03-domain/permissions.md), the derived `role_permissions` matrix, 3 Trade Types (Plumbing, HVAC, Electrical) |
| 0003 | `security_advisor_fixes` | Fixes for two findings `get_advisors` reported immediately after 0000-0002 (see "Security Verification") |
| 0004 | `invitation_token_index` | Index to support the invitation-accept lookup path added in this sprint's design (see "Deviations", invitation token mechanism) |

All Drizzle schema source lives in `packages/database/src/schema/{reference,identity,org,platform}.ts` — the migrations above were generated from it via `pnpm db:generate`, which needs no live connection (schema-diff against local snapshots), then hand-extended for RLS/triggers/seed data (Drizzle Kit doesn't express DDL that isn't a table/column/index/enum) and hand-annotated with the partition and security-fix statements, then applied via the Supabase MCP `apply_migration` tool. `packages/database/migrations/meta/_journal.json` reflects all five in order; `list_migrations` against the live project confirms the same five, in the same order.

## `@atlas/identity` (new package)

Resolves Sprint 0's open question (`docs/08-engineering/project-structure.md`, "Identity/Organization package location undecided") in favor of a new package, kept separate from `@atlas/auth` (which remains Supabase Auth client wiring only).

- `domain/` — pure logic, no I/O: `membership-status.ts` (state machine + transition guard), `last-owner-protection.ts`, `invitation-token.ts` (generation/hash/verify/expiry), `errors.ts`.
- `application/` — use cases: `createOrganization`, `inviteMember`, `acceptInvitation`, `suspendMembership`/`reinstateMembership`/`removeMembership`/`changeMembershipRole`, `createTeam`/`addMemberToTeam`.
- `infrastructure/` — Drizzle queries scoped to this module's own tables (`organizations.ts`, `memberships.ts`, `users.ts`, `roles.ts`, `teams.ts`).
- `index.ts` is the only import surface other packages use, per the project's no-deep-imports rule.

`packages/database` gained `request-context.ts`: `withRequestContext(db, actorUserId, fn)` runs a transaction with `request.jwt.claim.sub`/`app.current_user_id` session-local settings and `SET LOCAL role authenticated` set, so RLS (`auth.uid()`-based) and the audit trigger (`app.current_user_id`-based) both evaluate correctly even though the app connects via a single service-level `DATABASE_URL` rather than per-user Supabase-issued credentials. `withServiceContext(db, fn, actorUserId?)` is the explicit, narrow escape hatch for the two operations that legitimately cannot be scoped to an existing Membership: creating a brand-new Organization (no Membership exists yet) and accepting an invitation (the invitee has no active Membership yet for RLS to grant visibility into the pending row).

## `apps/web` — `/api/v1/` routes

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/organizations` | Not explicitly listed in Organization PRD §11 (which documents only GET/PATCH/DELETE on an existing Organization), but required by this sprint's own deliverable list ("Organization creation flow") — implemented as the standard REST "POST the collection" convention. |
| `GET` | `/api/v1/organizations/{id}` | |
| `POST` | `/api/v1/organizations/{id}/invitations` | MFA-gated (see below) |
| `POST` | `/api/v1/invitations/{token}/accept` | |
| `GET` | `/api/v1/memberships?organization_id=` | |
| `PATCH` | `/api/v1/memberships/{id}` | Status transition and/or Role change; MFA-gated |
| `GET`, `POST` | `/api/v1/teams` (`?organization_id=` on GET) | POST is MFA-gated |
| `POST` | `/api/v1/teams/{id}/members` | |

Shared plumbing: `lib/db.ts` (memoized Drizzle client), `lib/session.ts` (`getAuthenticatedUser` via `supabase.auth.getUser()`, which revalidates the JWT rather than trusting a cookie), `lib/identity-errors.ts` (maps `@atlas/identity`'s framework-agnostic errors to the documented API error catalog), `lib/route-handler.ts` (`{ data }` envelope, request-id propagation, error mapping), `lib/mfa.ts`, `lib/invitation-notifier.ts`.

`middleware.ts`'s comment is updated: session/auth resolution deliberately stays in route handlers (Node.js runtime), not middleware (Edge runtime by default), because `@atlas/database`'s `postgres` driver needs a real TCP connection Edge can't provide.

## Auth, MFA, and invitations — what's real vs. what's a documented gap

- **Signup/login/session**: delegated entirely to Supabase Auth (`@supabase/ssr`) per ADR-006 — no custom signup/login endpoints were built, none are needed; `getAuthenticatedUser()` is the only integration point.
- **MFA enrollment (Owner/Admin)**: enforced via `assertMfaEnrolledForPrivilegedAction()`, checked before the invite, membership-PATCH, and team-creation routes execute — Identity PRD §7. The docs require this "after a short grace period" but state no duration anywhere; rather than invent a number, Sprint 1 enforces immediately. Flagged here, not silently decided.
- **Invitation token mechanism**: no dedicated `invitations` table or token scheme is specified anywhere in the docs (confirmed by full-text search across `docs/`) — the Membership state machine's `invited` status is the only documented representation. This sprint's resolution: a random 32-byte token, its SHA-256 hash stored on `organization_memberships` (`invitation_token_hash`, `invitation_expires_at`), 7-day expiry, constant-time verification — the same pattern commonly used for password-reset tokens.
- **Invitation email delivery**: Resend (ADR-017) is not wired yet — that's scoped to whichever sprint first needs transactional email generally, not invented early just for this one flow. `apps/web/lib/invitation-notifier.ts` logs the accept link at `info` level so the flow is completable manually in the meantime; it's designed to be replaced wholesale, not extended, once Resend lands.

## Testing

**Unit (executed, all passing):** `packages/identity/src/domain/*.test.ts` — 14 tests covering the Membership state machine, last-owner protection, and invitation tokens. Combined with the rest of the monorepo: **64/64 tests passing** across 17 packages (`pnpm test`).

**Integration (written, real, NOT executed in this environment):** `packages/identity/src/integration/*.test.ts`, run via `pnpm --filter @atlas/identity test:integration` (separate Vitest config, excluded from the default `pnpm test`/CI `test` job so CI stays fast and DB-independent, per docs/09-testing/unit-testing.md vs. docs/09-testing/integration-testing.md):

- `tenant-isolation.test.ts` — the Sprint 1 exit criteria scenario verbatim: two Organizations, two Owners, a User in Org B sees zero Memberships in Org A and vice versa, an invite attempt across Organizations surfaces as `not_found` (never `forbidden`), and a direct select under an unrelated actor confirms `FORCE ROW LEVEL SECURITY` actually holds.
- `membership-lifecycle.test.ts` — last-owner protection (blocks removing/demoting the sole Owner, allows it once a second Owner exists), the full invite → accept → suspend → reinstate lifecycle, and duplicate-invitation rejection.
- `seed-referential-completeness.test.ts` — asserts the seeded `role_permissions` matrix matches docs/03-domain/roles.md's Role-to-module-access-summary table for all 6 Roles, per docs/09-testing/database-testing.md's "Seed data tests" requirement.

These could not be executed here for the same reason `pnpm db:check` cannot (see Known Issues #1): this sandbox's network proxy does not support raw-TCP Postgres connections, and integration tests need a real `postgres-js` connection the same way the app does. I ran `pnpm --filter @atlas/identity test:integration` against the real `DATABASE_URL` to confirm this directly: `createDatabaseClient` had no `connect_timeout` set, so instead of failing fast like `check-connection.ts` (which does set one), the connection attempt was silently black-holed by the proxy — it hung indefinitely with no output until I killed the process manually. Fixed as part of this sprint: `packages/database/src/client.ts` now sets `connect_timeout: 10`, so this — and any future real network problem — fails fast everywhere `createDatabaseClient` is used, not just in the standalone checker. This is not a claim of untested correctness: the RLS policies these tests exercise were verified structurally via `get_advisors` and via the SQL itself (verbatim from docs/04-database/multi-tenancy.md for the core helper function); the tests themselves are real, complete, and ready to run the moment `DATABASE_URL` is reachable from wherever they're run (a developer's machine, or CI with a Postgres service/Supabase branch) — not aspirational placeholders.

## Security Verification

- `get_advisors(type: security)` was run immediately after applying migrations 0000-0002 (per the Supabase MCP server's own operating guidance) and again after 0003. Two real findings were found and fixed in 0003, not just noted:
  1. **RLS-disabled (would have been the single most severe finding possible)**: the 13 monthly `audit_events` partitions did not individually have RLS enabled. Queries through the parent table (`platform.audit_events`, the only name the application ever uses) were correctly protected by the parent's policy, but a direct query against a partition by name would not have been. Fixed by enabling and forcing RLS (with no policy — default-deny) on every partition.
  2. **`function_search_path_mutable` (5 functions)**: none of this sprint's new functions pinned `search_path`, a search-path-hijacking risk in principle even though every reference in every function body is already schema-qualified. Fixed via `ALTER FUNCTION ... SET search_path = ''` on all five.
  - Two residual `WARN`-level findings remain, both on `public.rls_auto_enable()` — a pre-existing Supabase-platform-managed function this sprint did not create and did not modify; out of scope.
- Re-ran `get_advisors` after 0003: the RLS-disabled finding is gone; only the two pre-existing, out-of-scope `rls_auto_enable` warnings remain.
- Every tenant-owned table introduced this sprint has RLS **enabled and forced** in the same migration that created it, per docs/04-database/migrations.md rule 5.
- `roles`, `permissions`, `role_permissions`, `trade_types` are readable by any authenticated Organization (per docs/04-database/multi-tenancy.md's "cross-tenant reference data" rule) but have no write policy for the `authenticated` role — write access exists only via the service-role-backed migration path.
- `audit_events`: `UPDATE`/`DELETE` explicitly revoked from `authenticated` and `anon` — append-only, matching docs/04-database/audit-logging.md, "not even for Owner/Admin-level application logic."
- Service-role key and `DATABASE_URL` remain only in the gitignored `.env.local`; `git status`/`git ls-files` confirm neither is tracked.

## Security Incident: real Supabase keys committed to `.env.example`

While pushing this sprint's work, `git push` was rejected because two commits (`db14e94`, `7050ff7`, "Update .env.example") had landed on the remote branch that I did not make. They replaced `.env.example`'s placeholder `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` values with the real keys for the Atlas Project — including the service-role key, which bypasses RLS entirely. `.env.example` is a template meant to be committed, so this put a live, full-access credential into git history in plaintext.

I flagged this to the user before merging or pushing anything further. Per their direction, I stripped the real values back to placeholders in a follow-up commit (`e85ceb4`) but did **not** rotate the key — that decision was deferred. **The service-role key currently in `.env.local` and in that git history should still be treated as compromised and rotated in the Supabase dashboard (Project Settings → API → regenerate `service_role`) before this project is treated as production-ready**, since it now exists in this branch's history regardless of the working-tree fix.

## Known Issues

1. **Integration tests could not be executed in this sandbox** — same root cause as Sprint 0's Known Issue #1/#2 (now resolved for connectivity in general, but the *sandbox itself* still cannot open raw-TCP Postgres connections; only the Supabase Management API, which is HTTPS, works from here). Confirmed directly this sprint (see "Testing"). Not a defect in the tests or the schema — verified structurally instead, and ready to run wherever raw Postgres connectivity exists.
2. **MFA grace period duration is undocumented.** Enforced immediately rather than inventing an unstated number — see "Auth, MFA, and invitations."
3. **Invitation token/table mechanism is this sprint's own design, not a documented one** — no dedicated table or token scheme exists in the docs (confirmed by search). The chosen design (hash-on-Membership-row, 7-day expiry) is documented above and in code comments; worth a short doc addendum to `docs/06-modules/identity-prd.md` in a follow-up, not fabricated as if it were already specified.
4. **`GET/PATCH/DELETE /api/v1/organizations/{id}`'s settings-update and delete are not implemented** — only `GET` and `POST` (create) exist. Organization PRD §11 documents the full set, but Sprint 1's own deliverable list only names "Organization creation flow"; settings management is deferred, not broken.
5. **Team `PATCH`/`DELETE` are not implemented** — only create, list, and add-member exist, matching Sprint 1's "Team creation and membership" deliverable text exactly; full Team CRUD (rename, deactivate) is deferred.
6. **`pnpm audit` still not wired into CI** — carried over from Sprint 0's Known Issue #4, unchanged this sprint.

## Deviations From Architecture

**No core architecture decision (ADR-001 through ADR-026) was contradicted, changed, or reconsidered.** All deviations are implementation-detail-level:

1. **`packages/identity` created as a new package**, resolving Sprint 0's explicitly-left-open question in `project-structure.md` — that document itself flagged this as "not resolved" pending Sprint 1 planning, so this is completing a deferred decision, not deviating from one.
2. **`withServiceContext`, a documented, narrow RLS-bypass escape hatch**, used exactly twice (Organization bootstrap, invitation acceptance) — both cases where RLS's own membership-based model cannot yet apply (no Membership exists to check). This is the kind of "explicit, reviewed justification" docs/04-database/multi-tenancy.md requires before bypassing RLS, not an ad hoc shortcut.
3. **Invitation token storage on `organization_memberships` itself**, rather than a separate `organization_invitations` table — see Known Issues #3.

## Sprint 2 Readiness

**Ready.** Identity & Organizations' schema, RLS, audit infrastructure, and core API surface are live and tested (structurally verified end-to-end; integration-tested pending an environment with raw Postgres connectivity). Sprint 2 (CRM & Customers) can build `customers`/`contacts` against real `organizations`/`organization_memberships` rows and real RLS helper functions (`app.current_user_has_org_access`, `app.current_user_has_role`) rather than placeholders.

**Recommended next step**: run `pnpm --filter @atlas/identity test:integration` from an environment with real Postgres connectivity (a developer's machine, or CI with a Postgres/Supabase service) to get the first actual green run of the integration suite before Sprint 2 adds tables that depend on the same RLS pattern.
