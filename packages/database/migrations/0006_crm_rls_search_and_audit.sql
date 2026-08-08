-- CRM (Sprint 2): search infrastructure, RLS, and audit triggers for
-- crm.customers and crm.contacts. See
-- docs/02-architecture/search-strategy.md, docs/04-database/indexes.md,
-- docs/04-database/multi-tenancy.md, docs/07-security/tenant-isolation.md,
-- docs/04-database/audit-logging.md, docs/13-roadmap/sprint-2.md.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

-- Permission-catalog-based access check, layered on top of Sprint 1's
-- app.current_user_has_org_access / app.current_user_has_role. Customers
-- access varies per Role in a way that isn't a fixed role-name list
-- (Dispatcher: read+write, no delete; Technician/Read Only: read only;
-- Accountant: read+write per this sprint's role-permission addition; see
-- SPRINT-2-COMPLETION-REPORT.md) — see docs/03-domain/permissions.md,
-- "Permissions are checked at two layers." This function makes RLS follow
-- identity.role_permissions directly instead of hard-coding role names
-- into each policy, so a future change to the seeded role_permissions
-- matrix doesn't require a new migration touching every CRM RLS policy.
-- Not SECURITY DEFINER: it queries identity.organization_memberships /
-- membership_roles (self-visible under those tables' own RLS, same as
-- the two existing helper functions) and identity.role_permissions /
-- permissions (readable by every authenticated user per Sprint 1).
CREATE OR REPLACE FUNCTION app.current_user_has_permission(target_org_id uuid, target_resource text, target_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM identity.organization_memberships m
    JOIN identity.membership_roles mr ON mr.membership_id = m.id
    JOIN identity.role_permissions rp ON rp.role_id = mr.role_id
    JOIN identity.permissions p ON p.id = rp.permission_id
    WHERE m.user_id = auth.uid()
      AND m.organization_id = target_org_id
      AND m.status = 'active'
      AND p.resource = target_resource
      AND p.action = target_action
  )
$$;
--> statement-breakpoint

-- customers.search_vector: weighted, generated tsvector over display_name
-- — see docs/02-architecture/search-strategy.md. Customer phone/email
-- live on Contacts (docs/03-domain/customers.md business rule 2: a
-- residential Customer's phone/email is always represented via an
-- implicit primary Contact, never duplicated onto the Customer row), so a
-- phone/email search matches the Contact record, not the Customer row —
-- CRM PRD S17's "results are grouped by type" already expects Customers
-- and Contacts as separate, independently-matchable result groups.
ALTER TABLE "crm"."customers" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(display_name, '')), 'A')) STORED;
--> statement-breakpoint

ALTER TABLE "crm"."contacts" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(phone, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(email, '')), 'B')
  ) STORED;
--> statement-breakpoint

-- Indexes — docs/04-database/indexes.md: every organization_id and
-- foreign key indexed, GIN for full-text search, GIN pg_trgm for
-- typo-tolerant partial matching (CRM PRD acceptance criteria S18).
CREATE INDEX "idx_customers_organization_id_deleted_at" ON "crm"."customers" ("organization_id", "deleted_at");
--> statement-breakpoint
CREATE INDEX "idx_customers_search_vector" ON "crm"."customers" USING GIN ("search_vector");
--> statement-breakpoint
CREATE INDEX "idx_customers_display_name_trgm" ON "crm"."customers" USING GIN ("display_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "idx_contacts_organization_id_deleted_at" ON "crm"."contacts" ("organization_id", "deleted_at");
--> statement-breakpoint
CREATE INDEX "idx_contacts_customer_id" ON "crm"."contacts" ("customer_id");
--> statement-breakpoint
CREATE INDEX "idx_contacts_search_vector" ON "crm"."contacts" USING GIN ("search_vector");
--> statement-breakpoint
CREATE INDEX "idx_contacts_name_trgm" ON "crm"."contacts" USING GIN ("name" gin_trgm_ops);
--> statement-breakpoint

-- crm.customers: directly tenant-owned. Read/write/delete gated by the
-- customers Permission (docs/03-domain/permissions.md catalog: customers
-- read/write/delete), not a fixed role-name list — see
-- docs/03-domain/customers.md, "Permission requirements."
ALTER TABLE "crm"."customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm"."customers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY customers_select ON "crm"."customers"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'customers', 'read'));
--> statement-breakpoint
CREATE POLICY customers_insert ON "crm"."customers"
  FOR INSERT TO authenticated
  WITH CHECK (app.current_user_has_permission(organization_id, 'customers', 'write'));
--> statement-breakpoint
-- UPDATE covers both ordinary field edits (customers:write) and
-- soft-delete/restore, which is implemented as an UPDATE setting/clearing
-- deleted_at (docs/05-api/resource-conventions.md: "DELETE: Soft-delete
-- ... never a hard delete via the API"), gated by customers:delete. RLS
-- grants row access to either permission holder; the application layer's
-- use-case boundary is what actually restricts which use case (and
-- therefore which columns) each permission may touch — see
-- SPRINT-2-COMPLETION-REPORT.md, "RLS and Tenant Isolation."
CREATE POLICY customers_update ON "crm"."customers"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'customers', 'write')
    OR app.current_user_has_permission(organization_id, 'customers', 'delete')
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'customers', 'write')
    OR app.current_user_has_permission(organization_id, 'customers', 'delete')
  );
--> statement-breakpoint
-- No DELETE policy: hard DELETE is never issued by the application
-- (soft-delete only), and the absence of any policy for that command
-- means RLS default-denies it outright for `authenticated` — the same
-- pattern Sprint 1 relied on for identity.roles/permissions.
CREATE TRIGGER audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON "crm"."customers"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- crm.contacts: directly tenant-owned via its own organization_id column
-- (denormalized from the parent Customer — see
-- packages/database/src/schema/crm.ts). Same Permission set as Customers
-- — docs/03-domain/contacts.md, "Permission requirements": "there is no
-- independent Contact-level permission."
ALTER TABLE "crm"."contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm"."contacts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY contacts_select ON "crm"."contacts"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'customers', 'read'));
--> statement-breakpoint
CREATE POLICY contacts_insert ON "crm"."contacts"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'customers', 'write')
    AND EXISTS (
      SELECT 1 FROM crm.customers c
      WHERE c.id = contacts.customer_id
        AND c.organization_id = contacts.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY contacts_update ON "crm"."contacts"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'customers', 'write')
    OR app.current_user_has_permission(organization_id, 'customers', 'delete')
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'customers', 'write')
    OR app.current_user_has_permission(organization_id, 'customers', 'delete')
  );
--> statement-breakpoint
CREATE TRIGGER audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON "crm"."contacts"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
