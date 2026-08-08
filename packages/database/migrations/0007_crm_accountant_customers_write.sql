-- CRM (Sprint 2): grants Accountant the customers:write Permission.
--
-- Sprint 1's seed (0002_seed_platform_data.sql) granted Accountant only
-- customers:read, following docs/03-domain/roles.md's module-summary row
-- ("Customers/Properties: R" for Accountant). docs/06-modules/
-- customers-prd.md is more specific and postdates that summary in this
-- sprint's authority: S5 lists an Accountant user story requiring them to
-- edit a Customer's billing address ("I want a Customer's billing address
-- distinct from any Property's service address"), and S12 states
-- "Accountant: read/write on billing fields, read-only otherwise."
--
-- Atlas's Permission model (docs/03-domain/permissions.md) is
-- resource:action, not resource:action:field — there is no field-level
-- grant to express "write on billing fields only." Rather than invent a
-- second, finer-grained authorization mechanism (explicitly disallowed —
-- see docs/06-modules "Do not create a second authorization system"),
-- this grants the coarser customers:write, documented here as a
-- deliberate, reviewed extension of Sprint 1's role-permission matrix per
-- that PRD's explicit intent — see SPRINT-2-COMPLETION-REPORT.md,
-- "Permissions."
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM identity.roles r, identity.permissions p
WHERE r.name = 'accountant'
  AND p.resource = 'customers'
  AND p.action = 'write'
ON CONFLICT DO NOTHING;
