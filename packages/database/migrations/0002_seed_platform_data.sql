-- Platform-fixed seed data: Roles, Permissions, Role<->Permission mapping,
-- Trade Types. Seeded once as reference data, not tenant-editable at
-- launch — see docs/04-database/seed-data.md, docs/03-domain/roles.md,
-- docs/03-domain/permissions.md, ADR-008.
--
-- The Permission catalog below is the full resource:action table from
-- docs/03-domain/permissions.md; the Role<->Permission mapping is derived
-- by combining that catalog with the "Role-to-module access summary" table
-- in docs/03-domain/roles.md and each in-scope module PRD's "Permission
-- Requirements" section — see SPRINT-1-COMPLETION-REPORT.md for the exact
-- reasoning, since the docs give a module-level summary, not a literal
-- resource:action x Role matrix.

INSERT INTO identity.roles (name, display_name) VALUES
  ('owner', 'Owner'),
  ('admin', 'Admin'),
  ('dispatcher', 'Dispatcher'),
  ('technician', 'Technician'),
  ('accountant', 'Accountant'),
  ('read_only', 'Read Only');
--> statement-breakpoint

INSERT INTO identity.permissions (resource, action) VALUES
  ('organization', 'read'),
  ('organization', 'manage_settings'),
  ('organization', 'manage_billing'),
  ('organization', 'manage_users'),
  ('customers', 'read'),
  ('customers', 'write'),
  ('customers', 'delete'),
  ('properties', 'read'),
  ('properties', 'write'),
  ('properties', 'delete'),
  ('assets', 'read'),
  ('assets', 'write'),
  ('assets', 'delete'),
  ('jobs', 'read'),
  ('jobs', 'read_assigned'),
  ('jobs', 'write'),
  ('jobs', 'write_assigned'),
  ('jobs', 'delete'),
  ('jobs', 'assign'),
  ('scheduling', 'read'),
  ('scheduling', 'write'),
  ('estimates', 'read'),
  ('estimates', 'write'),
  ('estimates', 'finalize'),
  ('estimates', 'void'),
  ('invoices', 'read'),
  ('invoices', 'write'),
  ('invoices', 'finalize'),
  ('invoices', 'void'),
  ('payments', 'read'),
  ('payments', 'capture'),
  ('payments', 'refund'),
  ('inventory', 'read'),
  ('inventory', 'write'),
  ('inventory', 'consume'),
  ('reports', 'read_own_team'),
  ('reports', 'read_organization'),
  ('audit', 'read');
--> statement-breakpoint

-- Owner: every permission in the catalog.
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'owner';
--> statement-breakpoint

-- Admin: every permission except organization:manage_billing (Owner-only —
-- see docs/13-roadmap/sprint-1.md exit criteria, "cannot access Owner-only
-- settings").
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'admin'
  AND NOT (p.resource = 'organization' AND p.action = 'manage_billing');
--> statement-breakpoint

-- Dispatcher.
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'dispatcher'
  AND (p.resource, p.action) IN (
    ('customers', 'read'), ('customers', 'write'),
    ('properties', 'read'), ('properties', 'write'),
    ('assets', 'read'), ('assets', 'write'),
    ('jobs', 'read'), ('jobs', 'write'), ('jobs', 'assign'),
    ('scheduling', 'read'), ('scheduling', 'write'),
    ('estimates', 'read'), ('invoices', 'read'),
    ('payments', 'read'), ('inventory', 'read'),
    ('reports', 'read_own_team')
  );
--> statement-breakpoint

-- Technician: assigned-scope access only.
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'technician'
  AND (p.resource, p.action) IN (
    ('customers', 'read'), ('properties', 'read'), ('assets', 'read'),
    ('jobs', 'read_assigned'), ('jobs', 'write_assigned'),
    ('scheduling', 'read'),
    ('estimates', 'read'), ('estimates', 'write'),
    ('invoices', 'read'), ('invoices', 'write'),
    ('payments', 'read'), ('payments', 'capture'),
    ('inventory', 'read'), ('inventory', 'consume')
  );
--> statement-breakpoint

-- Accountant: financial-entity focus; no Organization/Users access.
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'accountant'
  AND (p.resource, p.action) IN (
    ('customers', 'read'), ('properties', 'read'), ('assets', 'read'),
    ('jobs', 'read'), ('scheduling', 'read'),
    ('estimates', 'read'), ('estimates', 'write'), ('estimates', 'finalize'), ('estimates', 'void'),
    ('invoices', 'read'), ('invoices', 'write'), ('invoices', 'finalize'), ('invoices', 'void'),
    ('payments', 'read'), ('payments', 'capture'), ('payments', 'refund'),
    ('inventory', 'read'),
    ('reports', 'read_own_team'), ('reports', 'read_organization'),
    ('audit', 'read')
  );
--> statement-breakpoint

-- Read Only: read on every resource, write on nothing.
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'read_only'
  AND (
    p.action IN ('read', 'read_assigned', 'read_own_team', 'read_organization')
  );
--> statement-breakpoint

-- Trade Types — the field-service trades Atlas targets at launch, per
-- docs/00-overview/product-vision.md.
INSERT INTO reference.trade_types (name, slug) VALUES
  ('Plumbing', 'plumbing'),
  ('HVAC', 'hvac'),
  ('Electrical', 'electrical');
