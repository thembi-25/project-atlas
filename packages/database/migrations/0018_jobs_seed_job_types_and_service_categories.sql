-- Jobs, Scheduling & Dispatch (Sprint 4): platform-default Job Types and
-- Service Categories, per docs/03-domain/domain-overview.md#the-trade-agnostic-configuration-pattern
-- and ADR-009 — mirrors migration 0013's Asset Types seed exactly. A
-- small, representative set per launch Trade Type, not an exhaustive
-- catalog; Organization-authored custom Job Types/Service Categories are
-- not implemented this sprint (no write API — see
-- SPRINT-4-COMPLETION-REPORT.md, "Known Limitations"), same documented
-- gap already accepted for Asset Types in Sprint 3.

INSERT INTO jobs.service_categories (organization_id, name) VALUES
  (NULL, 'Repair'),
  (NULL, 'Installation'),
  (NULL, 'Maintenance');
--> statement-breakpoint

INSERT INTO jobs.job_types (organization_id, trade_type_id, name, default_duration_minutes)
SELECT NULL, t.id, v.name, v.default_duration_minutes
FROM reference.trade_types t
JOIN (VALUES
  ('plumbing', 'Drain Cleaning', 60),
  ('plumbing', 'Water Heater Repair', 90),
  ('plumbing', 'Fixture Installation', 120),
  ('hvac', 'AC Repair', 90),
  ('hvac', 'Furnace Repair', 90),
  ('hvac', 'System Installation', 240),
  ('electrical', 'Panel Upgrade', 240),
  ('electrical', 'Outlet/Switch Repair', 60),
  ('electrical', 'Generator Installation', 240)
) AS v(slug, name, default_duration_minutes) ON v.slug = t.slug;
--> statement-breakpoint

-- One checklist_template per seeded Job Type, each with a single
-- representative required Task — tasks.md: "instantiated from a
-- checklist_template/form_definition item at Job creation." A minimal,
-- real seed (not an elaborate compliance checklist library, which is out
-- of this sprint's scope) so the Job-creation flow's Task-copy behavior
-- is exercised end to end.
INSERT INTO jobs.checklist_templates (organization_id, job_type_id, name)
SELECT NULL, jt.id, jt.name || ' Checklist'
FROM jobs.job_types jt
WHERE jt.organization_id IS NULL;
--> statement-breakpoint

INSERT INTO jobs.checklist_template_items (organization_id, checklist_template_id, label, type, is_required, sort_order)
SELECT NULL, ct.id, 'Photo of completed work', 'photo', true, 0
FROM jobs.checklist_templates ct
WHERE ct.organization_id IS NULL;
