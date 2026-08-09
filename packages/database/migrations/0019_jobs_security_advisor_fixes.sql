-- Jobs, Scheduling & Dispatch (Sprint 4): post-migration security/
-- performance advisor fixes (mcp__Supabase__get_advisors after migration
-- 0018), mirroring migration 0014's precedent.
--
-- 1. `unindexed_foreign_keys` (20 findings): every jobs-schema foreign
--    key without a covering index. `job_number_counters`'s RLS-blocked,
--    zero-policy design (documented in migration 0017) is intentional
--    and unrelated to this finding category.
-- 2. `auth_rls_initplan` (14 findings): the 14 new SELECT/UPDATE/INSERT
--    policies from migration 0017 that call `auth.uid()` directly cause
--    Postgres to re-evaluate it per row instead of once per query via an
--    InitPlan. Fixed by wrapping every call as `(select auth.uid())`.
--    Pre-existing identical instances on `identity.organization_
--    memberships`/`identity.membership_roles`/`identity.users` from
--    Sprint 1 are NOT touched here — editing an already-applied
--    migration is against the project's migration-safety rule, and
--    retroactively patching other modules' policies is outside Sprint
--    4's scope; see SPRINT-4-COMPLETION-REPORT.md, "Known Limitations."

CREATE INDEX "idx_checklist_template_items_organization_id" ON "jobs"."checklist_template_items" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_checklist_templates_organization_id" ON "jobs"."checklist_templates" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_dispatch_events_dispatched_by_user_id" ON "jobs"."dispatch_events" ("dispatched_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_dispatch_events_organization_id" ON "jobs"."dispatch_events" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_job_assets_organization_id" ON "jobs"."job_assets" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_job_assignments_assigned_by_user_id" ON "jobs"."job_assignments" ("assigned_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_job_assignments_organization_id" ON "jobs"."job_assignments" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_job_status_history_changed_by_user_id" ON "jobs"."job_status_history" ("changed_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_job_status_history_organization_id" ON "jobs"."job_status_history" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_job_types_trade_type_id" ON "jobs"."job_types" ("trade_type_id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_contact_id" ON "jobs"."jobs" ("contact_id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_job_type_id" ON "jobs"."jobs" ("job_type_id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_service_category_id" ON "jobs"."jobs" ("service_category_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_event_assignments_organization_id" ON "jobs"."schedule_event_assignments" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_event_history_changed_by_user_id" ON "jobs"."schedule_event_history" ("changed_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_event_history_job_id" ON "jobs"."schedule_event_history" ("job_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_event_history_organization_id" ON "jobs"."schedule_event_history" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_tasks_checklist_template_item_id" ON "jobs"."tasks" ("checklist_template_item_id");
--> statement-breakpoint
CREATE INDEX "idx_tasks_completed_by_user_id" ON "jobs"."tasks" ("completed_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_tasks_organization_id" ON "jobs"."tasks" ("organization_id");
--> statement-breakpoint

-- auth_rls_initplan fixes: DROP + CREATE with `(select auth.uid())`.
DROP POLICY jobs_select ON "jobs"."jobs";
--> statement-breakpoint
CREATE POLICY jobs_select ON "jobs"."jobs"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = jobs.id AND ja.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint
DROP POLICY jobs_update ON "jobs"."jobs";
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
        WHERE ja.job_id = jobs.id AND ja.user_id = (select auth.uid())
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
          WHERE ja.job_id = jobs.id AND ja.user_id = (select auth.uid())
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

DROP POLICY job_assets_select ON "jobs"."job_assets";
--> statement-breakpoint
CREATE POLICY job_assets_select ON "jobs"."job_assets"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = job_assets.job_id AND ja.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint

DROP POLICY job_assignments_select ON "jobs"."job_assignments";
--> statement-breakpoint
CREATE POLICY job_assignments_select ON "jobs"."job_assignments"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja2
        WHERE ja2.job_id = job_assignments.job_id AND ja2.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint

DROP POLICY job_status_history_select ON "jobs"."job_status_history";
--> statement-breakpoint
CREATE POLICY job_status_history_select ON "jobs"."job_status_history"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = job_status_history.job_id AND ja.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint
DROP POLICY job_status_history_insert ON "jobs"."job_status_history";
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
          WHERE ja.job_id = job_status_history.job_id AND ja.user_id = (select auth.uid())
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = job_status_history.job_id AND j.organization_id = job_status_history.organization_id
    )
  );
--> statement-breakpoint

DROP POLICY tasks_select ON "jobs"."tasks";
--> statement-breakpoint
CREATE POLICY tasks_select ON "jobs"."tasks"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'read_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = tasks.job_id AND ja.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint
DROP POLICY tasks_insert ON "jobs"."tasks";
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
          WHERE ja.job_id = tasks.job_id AND ja.user_id = (select auth.uid())
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM jobs.jobs j
      WHERE j.id = tasks.job_id AND j.organization_id = tasks.organization_id
    )
  );
--> statement-breakpoint
DROP POLICY tasks_update ON "jobs"."tasks";
--> statement-breakpoint
CREATE POLICY tasks_update ON "jobs"."tasks"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = tasks.job_id AND ja.user_id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = tasks.job_id AND ja.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint

DROP POLICY schedule_events_select ON "jobs"."schedule_events";
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
        WHERE sea.schedule_event_id = schedule_events.id AND sea.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint

DROP POLICY schedule_event_assignments_select ON "jobs"."schedule_event_assignments";
--> statement-breakpoint
CREATE POLICY schedule_event_assignments_select ON "jobs"."schedule_event_assignments"
  FOR SELECT TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'scheduling', 'write')
    OR app.current_user_has_permission(organization_id, 'scheduling', 'read')
    OR (
      app.current_user_has_permission(organization_id, 'scheduling', 'read_assigned')
      AND user_id = (select auth.uid())
    )
  );
--> statement-breakpoint

DROP POLICY schedule_event_history_select ON "jobs"."schedule_event_history";
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
        WHERE sea.schedule_event_id = schedule_event_history.schedule_event_id AND sea.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint

DROP POLICY dispatch_events_select ON "jobs"."dispatch_events";
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
        WHERE ja.job_id = dispatch_events.job_id AND ja.user_id = (select auth.uid())
      )
    )
  );
--> statement-breakpoint
DROP POLICY dispatch_events_update ON "jobs"."dispatch_events";
--> statement-breakpoint
CREATE POLICY dispatch_events_update ON "jobs"."dispatch_events"
  FOR UPDATE TO authenticated
  USING (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = dispatch_events.job_id AND ja.user_id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    app.current_user_has_permission(organization_id, 'jobs', 'write')
    OR (
      app.current_user_has_permission(organization_id, 'jobs', 'write_assigned')
      AND EXISTS (
        SELECT 1 FROM jobs.job_assignments ja
        WHERE ja.job_id = dispatch_events.job_id AND ja.user_id = (select auth.uid())
      )
    )
  );
