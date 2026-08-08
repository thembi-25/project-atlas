-- Row Level Security (membership-based) and audit-logging trigger
-- infrastructure for Sprint 1's tables.
-- See docs/04-database/multi-tenancy.md, docs/07-security/tenant-isolation.md,
-- docs/04-database/audit-logging.md, docs/11-adr/ADR-007-multi-tenancy.md,
-- docs/11-adr/ADR-012-audit-logging.md.

CREATE SCHEMA IF NOT EXISTS "app";
--> statement-breakpoint

-- Membership-based tenant-access check. Checks the requesting user's
-- current, live Membership (never a cached JWT claim) — see
-- docs/04-database/multi-tenancy.md, "Why membership-based, not
-- JWT-claim-based." Exact definition per that document.
CREATE OR REPLACE FUNCTION app.current_user_has_org_access(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identity.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = target_org_id
      AND m.status = 'active'
  )
$$;
--> statement-breakpoint

-- Role-scoped check, used to layer additional restrictions on top of base
-- tenant isolation (e.g. a Technician seeing only assigned Jobs starting
-- Sprint 4) — see docs/07-security/tenant-isolation.md. Any of the given
-- role names counts as a match; an empty/absent match returns false.
CREATE OR REPLACE FUNCTION app.current_user_has_role(target_org_id uuid, VARIADIC role_names text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM identity.organization_memberships m
    JOIN identity.membership_roles mr ON mr.membership_id = m.id
    JOIN identity.roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
      AND m.organization_id = target_org_id
      AND m.status = 'active'
      AND r.name = ANY(role_names)
  )
$$;
--> statement-breakpoint

-- Resolves the acting user for an audit entry: the caller's own request
-- context when set explicitly (SET LOCAL app.current_user_id — used by
-- service-role/Drizzle connections that don't carry a Supabase JWT), else
-- falls back to auth.uid() (set automatically by Supabase for
-- PostgREST/RLS-authenticated requests). See
-- docs/04-database/audit-logging.md.
CREATE OR REPLACE FUNCTION app.current_actor_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_user_id', true), '')::uuid, auth.uid())
$$;
--> statement-breakpoint

-- Generic audit trigger function, attached to every tenant-owned table
-- introduced this migration. Computes a diff (jsonb) of changed columns,
-- resolves the acting user, and inserts one row into platform.audit_events
-- within the same transaction as the triggering change — see
-- docs/04-database/audit-logging.md, ADR-012.
CREATE OR REPLACE FUNCTION app.record_audit_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_organization_id uuid;
  v_entity_id uuid;
  v_action platform.audit_action;
  v_diff jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_entity_id := (to_jsonb(NEW)->>'id')::uuid;
    v_diff := jsonb_build_object('before', null, 'after', to_jsonb(NEW));
    v_organization_id := NULLIF(to_jsonb(NEW)->>'organization_id', '')::uuid;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_entity_id := (to_jsonb(NEW)->>'id')::uuid;
    v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
    v_organization_id := NULLIF(to_jsonb(NEW)->>'organization_id', '')::uuid;
  ELSE
    v_action := 'delete';
    v_entity_id := (to_jsonb(OLD)->>'id')::uuid;
    v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', null);
    v_organization_id := NULLIF(to_jsonb(OLD)->>'organization_id', '')::uuid;
  END IF;

  INSERT INTO platform.audit_events (
    organization_id, actor_user_id, actor_type, entity_type, entity_id, action, diff
  ) VALUES (
    v_organization_id,
    app.current_actor_user_id(),
    CASE WHEN app.current_actor_user_id() IS NULL THEN 'system' ELSE 'user' END,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    v_entity_id,
    v_action,
    v_diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint

-- organizations: the tenant root itself has no organization_id column;
-- its own "id" is the org boundary. Creation is not exposed as a direct
-- client insert under RLS — see the "no INSERT policy" note below — new
-- Organizations are created by the application's organization-bootstrap
-- route (creates the Organization row and its founding Owner Membership
-- atomically; see packages/identity), since a brand-new Organization
-- cannot yet have a Membership to check access against.
ALTER TABLE "org"."organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "org"."organizations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organizations_select ON "org"."organizations"
  FOR SELECT TO authenticated
  USING (app.current_user_has_org_access(id));
--> statement-breakpoint
CREATE POLICY organizations_update ON "org"."organizations"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_role(id, 'owner', 'admin'))
  WITH CHECK (app.current_user_has_role(id, 'owner', 'admin'));
--> statement-breakpoint
CREATE TRIGGER audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON "org"."organizations"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- organization_trade_types: indirectly scoped through organizations.
ALTER TABLE "org"."organization_trade_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "org"."organization_trade_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_trade_types_select ON "org"."organization_trade_types"
  FOR SELECT TO authenticated
  USING (app.current_user_has_org_access(organization_id));
--> statement-breakpoint
CREATE POLICY organization_trade_types_write ON "org"."organization_trade_types"
  FOR ALL TO authenticated
  USING (app.current_user_has_role(organization_id, 'owner', 'admin'))
  WITH CHECK (app.current_user_has_role(organization_id, 'owner', 'admin'));
--> statement-breakpoint

-- teams: directly tenant-owned.
ALTER TABLE "org"."teams" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "org"."teams" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY teams_select ON "org"."teams"
  FOR SELECT TO authenticated
  USING (app.current_user_has_org_access(organization_id));
--> statement-breakpoint
CREATE POLICY teams_write ON "org"."teams"
  FOR ALL TO authenticated
  USING (app.current_user_has_role(organization_id, 'owner', 'admin'))
  WITH CHECK (app.current_user_has_role(organization_id, 'owner', 'admin'));
--> statement-breakpoint
CREATE TRIGGER audit_teams
  AFTER INSERT OR UPDATE OR DELETE ON "org"."teams"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- team_members: indirectly scoped through teams.organization_id.
ALTER TABLE "org"."team_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "org"."team_members" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY team_members_select ON "org"."team_members"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org.teams t
      WHERE t.id = team_members.team_id
        AND app.current_user_has_org_access(t.organization_id)
    )
  );
--> statement-breakpoint
CREATE POLICY team_members_write ON "org"."team_members"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org.teams t
      WHERE t.id = team_members.team_id
        AND app.current_user_has_role(t.organization_id, 'owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org.teams t
      WHERE t.id = team_members.team_id
        AND app.current_user_has_role(t.organization_id, 'owner', 'admin')
    )
  );
--> statement-breakpoint

-- organization_memberships: directly tenant-owned. A User may always read
-- their own Membership rows (needed to discover which Organizations they
-- belong to in the first place) in addition to the standard org-access
-- check.
ALTER TABLE "identity"."organization_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."organization_memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_memberships_select ON "identity"."organization_memberships"
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR app.current_user_has_org_access(organization_id)
  );
--> statement-breakpoint
CREATE POLICY organization_memberships_write ON "identity"."organization_memberships"
  FOR ALL TO authenticated
  USING (app.current_user_has_role(organization_id, 'owner', 'admin'))
  WITH CHECK (app.current_user_has_role(organization_id, 'owner', 'admin'));
--> statement-breakpoint
CREATE TRIGGER audit_organization_memberships
  AFTER INSERT OR UPDATE OR DELETE ON "identity"."organization_memberships"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- membership_roles: indirectly scoped through organization_memberships.organization_id.
ALTER TABLE "identity"."membership_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."membership_roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY membership_roles_select ON "identity"."membership_roles"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM identity.organization_memberships m
      WHERE m.id = membership_roles.membership_id
        AND (m.user_id = auth.uid() OR app.current_user_has_org_access(m.organization_id))
    )
  );
--> statement-breakpoint
CREATE POLICY membership_roles_write ON "identity"."membership_roles"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM identity.organization_memberships m
      WHERE m.id = membership_roles.membership_id
        AND app.current_user_has_role(m.organization_id, 'owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM identity.organization_memberships m
      WHERE m.id = membership_roles.membership_id
        AND app.current_user_has_role(m.organization_id, 'owner', 'admin')
    )
  );
--> statement-breakpoint

-- users: platform-wide identity, not tenant-owned. A User may always read
-- and update their own row (Identity PRD §12). Reading another User's row
-- is allowed only when the reader shares an active Organization with them
-- (needed to render teammate names/avatars on Membership/Team lists).
ALTER TABLE "identity"."users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY users_select ON "identity"."users"
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM identity.organization_memberships mine
      JOIN identity.organization_memberships theirs
        ON theirs.organization_id = mine.organization_id
      WHERE mine.user_id = auth.uid()
        AND mine.status = 'active'
        AND theirs.user_id = users.id
        AND theirs.status = 'active'
    )
  );
--> statement-breakpoint
CREATE POLICY users_update_self ON "identity"."users"
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
--> statement-breakpoint
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON "identity"."users"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- roles, permissions, role_permissions, trade_types: cross-tenant platform
-- reference data. Readable by every authenticated Organization; writable
-- only via a service-role connection (migrations/seed data), which bypasses
-- RLS entirely in Supabase — see docs/04-database/multi-tenancy.md,
-- "Cross-tenant reference data." No INSERT/UPDATE/DELETE policy is defined
-- for the `authenticated` role, so those operations are denied by RLS's
-- default-deny for any role other than service_role.
ALTER TABLE "identity"."roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY roles_select ON "identity"."roles" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

ALTER TABLE "identity"."permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."permissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY permissions_select ON "identity"."permissions" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

ALTER TABLE "identity"."role_permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."role_permissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY role_permissions_select ON "identity"."role_permissions" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

ALTER TABLE "reference"."trade_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reference"."trade_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY trade_types_select ON "reference"."trade_types" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

-- audit_events: append-only. The application runtime role gets INSERT
-- (via the trigger, running as the table owner) and SELECT only — no
-- UPDATE/DELETE grant at all, not even for Owner/Admin application logic —
-- see docs/04-database/audit-logging.md. Readable within one's own
-- Organization; Owner/Admin per docs/03-domain/audit-events.md (finer-
-- grained, per-Role audit read scoping for Accountant etc. is deferred to
-- the sprint that introduces the audit-log UI/API).
ALTER TABLE "platform"."audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform"."audit_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY audit_events_select ON "platform"."audit_events"
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND app.current_user_has_role(organization_id, 'owner', 'admin')
  );
--> statement-breakpoint
REVOKE UPDATE, DELETE ON "platform"."audit_events" FROM authenticated;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON "platform"."audit_events" FROM anon;
