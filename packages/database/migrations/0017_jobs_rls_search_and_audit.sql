-- Jobs, Scheduling & Dispatch (Sprint 4): search infrastructure, indexes,
-- RLS, and audit triggers for jobs.{job_types, service_categories,
-- checklist_templates, checklist_template_items, jobs, job_assets,
-- job_assignments, job_status_history, tasks, schedule_events,
-- schedule_event_assignments, schedule_event_history, dispatch_events}.
-- See docs/02-architecture/search-strategy.md, docs/04-database/indexes.md,
-- docs/04-database/multi-tenancy.md, docs/07-security/tenant-isolation.md,
-- docs/04-database/audit-logging.md, docs/13-roadmap/sprint-4.md.
--
-- `jobs.job_number_counters` intentionally gets RLS enabled/forced with
-- ZERO policies below — it is never touched directly by a client; only
-- @atlas/jobs's job-number allocator writes to it, inside the same
-- request-context transaction as the Job INSERT, gated implicitly by
-- that transaction's own `jobs:write` check on the `jobs` INSERT policy.
-- FORCE ROW LEVEL SECURITY with no policy denies all `authenticated`-role
-- access, which is exactly the intended "internal counter, never a
-- client-readable/writable resource" behavior.

-- search_vector — search-strategy.md: "Job | job number, customer name
-- (denormalized), property address (denormalized)". Customer
-- name/Property address are NOT duplicated as stored columns on `jobs`
-- (see docs/13-roadmap/SPRINT-4-COMPLETION-REPORT.md, "Architecture
-- Decisions" — this is a documented, deliberate reading, not an omission):
-- `crm.customers` and `properties.properties` already carry their own
-- `search_vector` columns from Sprint 2/3, so Job search
-- (@atlas/jobs's `searchJobs`) joins to those existing indexes at query
-- time instead of re-storing the same text a third time. This
-- `jobs.search_vector` column covers only what is genuinely Job-owned
-- text: the human-readable job number and description.
ALTER TABLE "jobs"."jobs" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(job_number::text, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) STORED;
--> statement-breakpoint

-- Indexes — docs/04-database/indexes.md's explicit table for this module:
-- "jobs | (organization_id, status); (property_id); (customer_id);
-- (job_number) unique per org; GIN search_vector"; "job_assignments |
-- (user_id); (job_id)"; "schedule_events | (scheduled_start,
-- scheduled_end) with GiST for overlap detection"; "tasks | (job_id)".
CREATE INDEX "idx_jobs_organization_id_status" ON "jobs"."jobs" ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX "idx_jobs_property_id" ON "jobs"."jobs" ("property_id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_customer_id" ON "jobs"."jobs" ("customer_id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_search_vector" ON "jobs"."jobs" USING GIN ("search_vector");
--> statement-breakpoint
CREATE INDEX "idx_job_types_org_active" ON "jobs"."job_types" ("organization_id", "is_active");
--> statement-breakpoint
CREATE INDEX "idx_service_categories_org_active" ON "jobs"."service_categories" ("organization_id", "is_active");
--> statement-breakpoint
CREATE INDEX "idx_checklist_templates_job_type_id" ON "jobs"."checklist_templates" ("job_type_id");
--> statement-breakpoint
CREATE INDEX "idx_checklist_template_items_template_id" ON "jobs"."checklist_template_items" ("checklist_template_id");
--> statement-breakpoint
CREATE INDEX "idx_job_assets_job_id" ON "jobs"."job_assets" ("job_id");
--> statement-breakpoint
CREATE INDEX "idx_job_assets_asset_id" ON "jobs"."job_assets" ("asset_id");
--> statement-breakpoint
CREATE INDEX "idx_job_assignments_user_id" ON "jobs"."job_assignments" ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_job_assignments_job_id" ON "jobs"."job_assignments" ("job_id");
--> statement-breakpoint
CREATE INDEX "idx_job_status_history_job_id" ON "jobs"."job_status_history" ("job_id", "created_at");
--> statement-breakpoint
CREATE INDEX "idx_tasks_job_id" ON "jobs"."tasks" ("job_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_events_organization_id" ON "jobs"."schedule_events" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_events_team_id" ON "jobs"."schedule_events" ("team_id");
--> statement-breakpoint
-- GiST range index for overlap detection (`&&` on `tstzrange`) — the
-- Scheduling conflict-check query's core index, per indexes.md.
CREATE INDEX "idx_schedule_events_time_range" ON "jobs"."schedule_events"
  USING gist (tstzrange(scheduled_start, scheduled_end, '[)'));
--> statement-breakpoint
CREATE INDEX "idx_schedule_event_assignments_user_id" ON "jobs"."schedule_event_assignments" ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_event_assignments_event_id" ON "jobs"."schedule_event_assignments" ("schedule_event_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_event_history_event_id" ON "jobs"."schedule_event_history" ("schedule_event_id");
--> statement-breakpoint
CREATE INDEX "idx_dispatch_events_job_id_dispatched_at" ON "jobs"."dispatch_events" ("job_id", "dispatched_at" DESC);
--> statement-breakpoint

-- jobs.job_types: platform+org reference data, mirrors properties.asset_types
-- exactly (SELECT-only for `authenticated`; writes are seed-migration-only).
ALTER TABLE "jobs"."job_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."job_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY job_types_select ON "jobs"."job_types"
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
  );
--> statement-breakpoint

-- jobs.service_categories: same pattern.
ALTER TABLE "jobs"."service_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."service_categories" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY service_categories_select ON "jobs"."service_categories"
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
  );
--> statement-breakpoint

-- jobs.checklist_templates: same pattern.
ALTER TABLE "jobs"."checklist_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."checklist_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY checklist_templates_select ON "jobs"."checklist_templates"
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
  );
--> statement-breakpoint

-- jobs.checklist_template_items: same pattern.
ALTER TABLE "jobs"."checklist_template_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."checklist_template_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY checklist_template_items_select ON "jobs"."checklist_template_items"
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
  );
--> statement-breakpoint

-- jobs.job_number_counters: no policies at all — see header note. RLS is
-- still enabled/forced (every tenant-owned table gets RLS, per
-- docs/04-database/multi-tenancy.md), it simply grants nothing to
-- `authenticated`.
ALTER TABLE "jobs"."job_number_counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."job_number_counters" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- jobs.jobs: WITH CHECK verifies the referenced Customer and Property
-- both actually belong to the claimed organization_id — the "Tenant A
-- cannot create a Job referencing Tenant B's Customer/Property"
-- guarantee (docs/07-security/tenant-isolation.md).
ALTER TABLE "jobs"."jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY jobs_select ON "jobs"."jobs"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY jobs_insert ON "jobs"."jobs"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    AND EXISTS (
      SELECT 1 FROM crm.customers c
      WHERE c.id = jobs.customer_id AND c.organization_id = jobs.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM properties.properties p
      WHERE p.id = jobs.property_id AND p.organization_id = jobs.organization_id
    )
    AND (
      jobs.contact_id IS NULL
      OR EXISTS (
        SELECT 1 FROM crm.contacts ct
        WHERE ct.id = jobs.contact_id AND ct.organization_id = jobs.organization_id
      )
    )
  );
--> statement-breakpoint
CREATE POLICY jobs_update ON "jobs"."jobs"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR app.current_user_has_permission(organization_id, 'jobs', 'delete')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      app.current_user_has_permission(organization_id, 'jobs', 'write')
      OR app.current_user_has_permission(organization_id, 'jobs', 'delete')
      OR (
        app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
        AND EXISTS (
          SELECT 1 FROM jobs.job_assignments ja
          WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM crm.customers c
      WHERE c.id = jobs.customer_id AND c.organization_id = jobs.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM properties.properties p
      WHERE p.id = jobs.property_id AND p.organization_id = jobs.organization_id
    )
    AND (
      jobs.contact_id IS NULL
      OR EXISTS (
        SELECT 1 FROM crm.contacts ct
        WHERE ct.id = jobs.contact_id AND ct.organization_id = jobs.organization_id
      )
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_jobs
  AFTER INSERT OR UPDATE OR DELETE ON "jobs"."jobs"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- jobs.job_assets: WITH CHECK verifies both the referenced Job and the
-- referenced (properties-schema) Asset belong to the claimed
-- organization_id — "Tenant A cannot attach Tenant B's Asset to its Job."
ALTER TABLE "jobs"."job_assets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."job_assets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY job_assets_select ON "jobs"."job_assets"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = job_assets.job_id AND ja.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY job_assets_insert ON "jobs"."job_assets"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = job_assets.job_id AND j.organization_id = job_assets.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM properties.assets a
      WHERE a.id = job_assets.asset_id AND a.organization_id = job_assets.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY job_assets_delete ON "jobs"."job_assets"
  FOR DELETE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = job_assets.job_id AND j.organization_id = job_assets.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_job_assets
  AFTER INSERT OR UPDATE OR DELETE ON "jobs"."job_assets"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- jobs.job_assignments: gated on the dedicated `jobs:assign` Permission
-- (Dispatcher/Admin/Owner only — jobs-prd.md §12), not `jobs:write`.
-- WITH CHECK verifies the Job belongs to the claimed organization_id AND
-- the assigned User holds an active Membership in that same
-- organization_id — "Tenant A cannot assign Tenant B's Technician"
-- (docs/07-security/tenant-isolation.md).
ALTER TABLE "jobs"."job_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."job_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY job_assignments_select ON "jobs"."job_assignments"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja2
        WHERE ja2.job_id = job_assignments.job_id AND ja2.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY job_assignments_insert ON "jobs"."job_assignments"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'jobs', 'assign')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = job_assignments.job_id AND j.organization_id = job_assignments.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM identity.organization_memberships m
      WHERE m.user_id = job_assignments.user_id
        AND m.organization_id = job_assignments.organization_id
        AND m.status = 'active'
    )
  );
--> statement-breakpoint
CREATE POLICY job_assignments_delete ON "jobs"."job_assignments"
  FOR DELETE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'assign')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = job_assignments.job_id AND j.organization_id = job_assignments.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_job_assignments
  AFTER INSERT OR UPDATE OR DELETE ON "jobs"."job_assignments"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- jobs.job_status_history: append-only (no UPDATE/DELETE policy exists,
-- so FORCE ROW LEVEL SECURITY denies both outright).
ALTER TABLE "jobs"."job_status_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."job_status_history" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY job_status_history_select ON "jobs"."job_status_history"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = job_status_history.job_id AND ja.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY job_status_history_insert ON "jobs"."job_status_history"
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      app.current_user_has_permission(organization_id, 'jobs', 'write')
      OR (
        app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
        AND EXISTS (
          SELECT 1 FROM jobs.job_assignments ja
          WHERE ja.job_id = job_status_history.job_id AND ja.user_id = auth.uid()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = job_status_history.job_id AND j.organization_id = job_status_history.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_job_status_history
  AFTER INSERT ON "jobs"."job_status_history"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- jobs.tasks: same visibility/write scoping as the parent Job —
-- tasks.md, "Permission requirements: Same as parent Job."
ALTER TABLE "jobs"."tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tasks_select ON "jobs"."tasks"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = tasks.job_id AND ja.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY tasks_insert ON "jobs"."tasks"
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      app.current_user_has_permission(organization_id, 'jobs', 'write')
      OR (
        app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
        AND EXISTS (
          SELECT 1 FROM jobs.job_assignments ja
          WHERE ja.job_id = tasks.job_id AND ja.user_id = auth.uid()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = tasks.job_id AND j.organization_id = tasks.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY tasks_update ON "jobs"."tasks"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = tasks.job_id AND ja.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = tasks.job_id AND ja.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON "jobs"."tasks"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- jobs.schedule_events: `scheduling:write` is Dispatcher/Admin/Owner-only
-- (unchanged from Sprint 1's seed); Technician read access is scoped via
-- the new `scheduling:read_assigned` Permission (see migration 0016),
-- checked against schedule_event_assignments, not job_assignments — a
-- Technician sees a schedule_event only once actually assigned to it,
-- independent of whether they're also job_assignments-assigned to the
-- parent Job. WITH CHECK verifies the Job belongs to the claimed
-- organization_id — "Tenant A cannot schedule Tenant B's Job."
ALTER TABLE "jobs"."schedule_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."schedule_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY schedule_events_select ON "jobs"."schedule_events"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    OR app.current_user_has_permission(organization_id, 'scheduling', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'scheduling', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.schedule_event_assignments sea
        WHERE sea.schedule_event_id = schedule_events.id AND sea.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY schedule_events_insert ON "jobs"."schedule_events"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = schedule_events.job_id AND j.organization_id = schedule_events.organization_id
    )
    AND (
      schedule_events.team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM org.teams t
        WHERE t.id = schedule_events.team_id AND t.organization_id = schedule_events.organization_id
      )
    )
  );
--> statement-breakpoint
CREATE POLICY schedule_events_update ON "jobs"."schedule_events"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_permission(organization_id, 'scheduling', 'write'))
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = schedule_events.job_id AND j.organization_id = schedule_events.organization_id
    )
    AND (
      schedule_events.team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM org.teams t
        WHERE t.id = schedule_events.team_id AND t.organization_id = schedule_events.organization_id
      )
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_schedule_events
  AFTER INSERT OR UPDATE OR DELETE ON "jobs"."schedule_events"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- jobs.schedule_event_assignments: WITH CHECK verifies the Schedule Event
-- belongs to the claimed organization_id AND the assigned User holds an
-- active Membership in that same organization_id.
ALTER TABLE "jobs"."schedule_event_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."schedule_event_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY schedule_event_assignments_select ON "jobs"."schedule_event_assignments"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    OR app.current_user_has_permission(organization_id, 'scheduling', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'scheduling', 'read_assigned')
      AND user_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY schedule_event_assignments_insert ON "jobs"."schedule_event_assignments"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.schedule_events se
      WHERE se.id = schedule_event_assignments.schedule_event_id
        AND se.organization_id = schedule_event_assignments.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM identity.organization_memberships m
      WHERE m.user_id = schedule_event_assignments.user_id
        AND m.organization_id = schedule_event_assignments.organization_id
        AND m.status = 'active'
    )
  );
--> statement-breakpoint
CREATE POLICY schedule_event_assignments_delete ON "jobs"."schedule_event_assignments"
  FOR DELETE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.schedule_events se
      WHERE se.id = schedule_event_assignments.schedule_event_id
        AND se.organization_id = schedule_event_assignments.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_schedule_event_assignments
  AFTER INSERT OR UPDATE OR DELETE ON "jobs"."schedule_event_assignments"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- jobs.schedule_event_history: append-only.
ALTER TABLE "jobs"."schedule_event_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."schedule_event_history" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY schedule_event_history_select ON "jobs"."schedule_event_history"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    OR app.current_user_has_permission(organization_id, 'scheduling', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'scheduling', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.schedule_event_assignments sea
        WHERE sea.schedule_event_id = schedule_event_history.schedule_event_id AND sea.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY schedule_event_history_insert ON "jobs"."schedule_event_history"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.schedule_events se
      WHERE se.id = schedule_event_history.schedule_event_id
        AND se.organization_id = schedule_event_history.organization_id
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_schedule_event_history
  AFTER INSERT ON "jobs"."schedule_event_history"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- jobs.dispatch_events: SELECT mirrors Job visibility (Dispatcher/Admin/
-- Owner org-wide, Technician scoped to their own assigned Jobs). INSERT
-- (the dispatch action itself) is `jobs:write`-gated —
-- dispatch-prd.md §12: "Dispatcher/Admin/Owner: can dispatch." UPDATE
-- (acknowledge/en-route/arrived) additionally allows the assigned
-- Technician via `jobs:write_assigned` — dispatch-prd.md §12: "Technician:
-- can acknowledge/update dispatch status only for their own assigned
-- Jobs." Neither reuses a new "dispatch" Permission resource — both
-- documented behaviors map exactly onto the existing `jobs:write`/
-- `jobs:write_assigned` grants, so none was created (see
-- SPRINT-4-COMPLETION-REPORT.md, "Permissions").
ALTER TABLE "jobs"."dispatch_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs"."dispatch_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dispatch_events_select ON "jobs"."dispatch_events"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR app.current_user_has_permission(organization_id, 'scheduling', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = dispatch_events.job_id AND ja.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE POLICY dispatch_events_insert ON "jobs"."dispatch_events"
  FOR INSERT TO authenticated
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = dispatch_events.job_id AND j.organization_id = dispatch_events.organization_id
    )
  );
--> statement-breakpoint
CREATE POLICY dispatch_events_update ON "jobs"."dispatch_events"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = dispatch_events.job_id AND ja.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = dispatch_events.job_id AND ja.user_id = auth.uid()
      )
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_dispatch_events
  AFTER INSERT OR UPDATE OR DELETE ON "jobs"."dispatch_events"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
