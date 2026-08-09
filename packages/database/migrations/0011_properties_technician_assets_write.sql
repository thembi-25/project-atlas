-- Properties & Assets (Sprint 3): grants Technician the assets:write
-- Permission.
--
-- Sprint 1's seed (0002_seed_platform_data.sql) granted Technician only
-- assets:read, following docs/03-domain/roles.md's module-summary row
-- ("Customers/Properties: R (assigned only)" for Technician, which
-- Sprint 1/2 applied uniformly to assets too since roles.md has no
-- separate Assets row). docs/06-modules/assets-prd.md is more specific
-- for this entity: its Personas section names the Technician as the
-- primary Asset creator/updater ("creates/updates most Assets in the
-- field"), and its Permission Requirements section states "Same as
-- parent Property — Technicians can create/update Assets on Properties
-- tied to their assigned Jobs." Properties themselves stay
-- Technician-read-only (matching properties-prd.md §12 exactly); only
-- Assets gain write — this mirrors Sprint 2's Accountant/customers:write
-- addition (SPRINT-2-COMPLETION-REPORT.md, "Permissions") in both
-- reasoning and mechanism.
--
-- The "scoped to assigned Jobs" qualifier is not enforced here (Jobs
-- does not exist until Sprint 4 — see SPRINT-3-COMPLETION-REPORT.md,
-- "Known Limitations"), consistent with the same deferral already
-- documented for Technician's customers:read grant in Sprint 2.
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM identity.roles r, identity.permissions p
WHERE r.name = 'technician'
  AND p.resource = 'assets'
  AND p.action = 'write'
ON CONFLICT DO NOTHING;
