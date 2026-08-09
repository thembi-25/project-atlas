-- Jobs, Scheduling & Dispatch (Sprint 4): Permission catalog changes.
--
-- `jobs:*` and `scheduling:*` (read, write) were already seeded platform-
-- wide by Sprint 1's 0002_seed_platform_data.sql, anticipating this
-- module before it existed — reused here exactly as-is, with one
-- refinement documented below. No `dispatch` Permission resource is
-- created: dispatch-prd.md §12's "Dispatcher/Admin/Owner: can dispatch" /
-- "Technician: can acknowledge/update... only for their own assigned
-- Jobs" maps exactly onto the existing `jobs:write` / `jobs:write_assigned`
-- grants (see migration 0017's dispatch_events policies), so nothing new
-- was needed there.
--
-- Refinement: scheduling-prd.md §12 draws a real distinction Sprint 1's
-- speculative seed did not yet have the information to express —
-- "Dispatcher/Admin/Owner: full read/write. Technician: read-only on
-- their OWN schedule" (not the whole Organization's). Sprint 1 granted
-- Technician a bare `scheduling:read`, which is the same Permission
-- Dispatcher/Admin/Owner/Accountant hold for full-Organization
-- visibility — there was no way to distinguish "see everything" from
-- "see only what I'm assigned to" with one Permission. This mirrors the
-- exact `jobs:read`/`jobs:read_assigned` split already established in
-- the same seed file, so the fix is to add the missing
-- `scheduling:read_assigned` Permission and move Technician onto it,
-- leaving Dispatcher/Admin/Owner/Accountant's plain `scheduling:read`
-- untouched. See migration 0017's `schedule_events_select` policy for
-- where this is enforced, and SPRINT-4-COMPLETION-REPORT.md,
-- "Permissions" / "Deviations From Documentation".

INSERT INTO identity.permissions (resource, action) VALUES
  ('scheduling', 'read_assigned')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

DELETE FROM identity.role_permissions
WHERE role_id = (SELECT id FROM identity.roles WHERE name = 'technician')
  AND permission_id = (
    SELECT id FROM identity.permissions WHERE resource = 'scheduling' AND action = 'read'
  );
--> statement-breakpoint

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM identity.roles r, identity.permissions p
WHERE r.name = 'technician'
  AND p.resource = 'scheduling'
  AND p.action = 'read_assigned'
ON CONFLICT DO NOTHING;
