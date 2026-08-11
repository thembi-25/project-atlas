-- Notifications & Integrations (Sprint 7): indexes, RLS, and audit
-- triggers for notifications.{notifications, notification_preferences}
-- and integrations.{integration_connections, sync_records}. See
-- docs/04-database/indexes.md, docs/04-database/multi-tenancy.md,
-- docs/07-security/tenant-isolation.md, docs/04-database/audit-logging.md,
-- docs/13-roadmap/sprint-7.md.
--
-- Permission model recap: notification-preference self-management needs
-- no RBAC Permission at all — an owner manages only their own row,
-- scoped by identity (auth.uid() for staff Users, contacts.portal_user_id
-- for Portal Contacts), the same pattern as every other self-scoped
-- resource in this codebase. The `notifications` send log's staff-facing
-- SELECT additionally allows `organization:manage_settings` holders
-- (Owner/Admin) to see every recipient's notifications org-wide, per
-- notifications-prd.md §12's "Admin/Owner can view organization-wide
-- delivery-failure reports." `integration_connections`/`sync_records`
-- are Admin/Owner-only per integrations-prd.md §12's "high-privilege
-- action" framing — reusing the existing `organization:manage_settings`
-- Permission rather than inventing a new `integrations` resource.
--
-- `notifications.notifications` and `integrations.sync_records` get NO
-- INSERT/UPDATE policy — both are written exclusively by the Worker via
-- `withServiceContext` (bypassing RLS entirely), the same "internal
-- record, never a client-writable resource" pattern as
-- `jobs.job_number_counters` (migration 0017) and
-- `platform.stripe_webhook_events` (migration 0021). FORCE ROW LEVEL
-- SECURITY denies `authenticated`-role writes outright.

-- Indexes — FK-covering indexes added proactively (Sprint 5/6 precedent).
CREATE INDEX "idx_notifications_organization_id" ON "notifications"."notifications" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient_user_id" ON "notifications"."notifications" ("recipient_user_id");
--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient_contact_id" ON "notifications"."notifications" ("recipient_contact_id");
--> statement-breakpoint
CREATE INDEX "idx_notification_preferences_organization_id" ON "notifications"."notification_preferences" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_notification_preferences_owner_user_id" ON "notifications"."notification_preferences" ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "idx_notification_preferences_owner_contact_id" ON "notifications"."notification_preferences" ("owner_contact_id");
--> statement-breakpoint
CREATE INDEX "idx_integration_connections_organization_id" ON "integrations"."integration_connections" ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_integration_connections_connected_by_user_id" ON "integrations"."integration_connections" ("connected_by_user_id");
--> statement-breakpoint
CREATE INDEX "idx_sync_records_organization_id" ON "integrations"."sync_records" ("organization_id");
--> statement-breakpoint

-- notifications.notifications
ALTER TABLE "notifications"."notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications"."notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY notifications_select ON "notifications"."notifications"
  FOR SELECT TO authenticated
  USING (
    recipient_user_id = (select auth.uid())
    OR app.current_user_has_permission(organization_id, 'organization', 'manage_settings')
    OR EXISTS (
      SELECT 1 FROM crm.contacts c
      WHERE c.id = notifications.recipient_contact_id AND c.portal_user_id = (select auth.uid())
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_notifications
  AFTER INSERT OR UPDATE ON "notifications"."notifications"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- notifications.notification_preferences: self-managed by identity, not
-- Permission. WITH CHECK verifies the referenced owner_user_id has an
-- active Membership in the claimed organization_id (for User owners) —
-- "Tenant A cannot write a preference row claiming Tenant B's
-- organization_id." Contact-owned rows are verified against
-- `contacts.organization_id` instead.
ALTER TABLE "notifications"."notification_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications"."notification_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY notification_preferences_select ON "notifications"."notification_preferences"
  FOR SELECT TO authenticated
  USING (
    owner_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM crm.contacts c
      WHERE c.id = notification_preferences.owner_contact_id AND c.portal_user_id = (select auth.uid())
    )
  );
--> statement-breakpoint
CREATE POLICY notification_preferences_insert ON "notifications"."notification_preferences"
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      owner_type = 'user'
      AND owner_user_id = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM identity.organization_memberships m
        WHERE m.user_id = notification_preferences.owner_user_id
          AND m.organization_id = notification_preferences.organization_id
          AND m.status = 'active'
      )
    )
    OR (
      owner_type = 'contact'
      AND EXISTS (
        SELECT 1 FROM crm.contacts c
        WHERE c.id = notification_preferences.owner_contact_id
          AND c.portal_user_id = (select auth.uid())
          AND c.organization_id = notification_preferences.organization_id
      )
    )
  );
--> statement-breakpoint
CREATE POLICY notification_preferences_update ON "notifications"."notification_preferences"
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM crm.contacts c
      WHERE c.id = notification_preferences.owner_contact_id AND c.portal_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    owner_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM crm.contacts c
      WHERE c.id = notification_preferences.owner_contact_id AND c.portal_user_id = (select auth.uid())
    )
  );
--> statement-breakpoint
CREATE TRIGGER audit_notification_preferences
  AFTER INSERT OR UPDATE OR DELETE ON "notifications"."notification_preferences"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- integrations.integration_connections: Admin/Owner only.
ALTER TABLE "integrations"."integration_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "integrations"."integration_connections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY integration_connections_select ON "integrations"."integration_connections"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'organization', 'manage_settings'));
--> statement-breakpoint
CREATE POLICY integration_connections_insert ON "integrations"."integration_connections"
  FOR INSERT TO authenticated
  WITH CHECK (app.current_user_has_permission(organization_id, 'organization', 'manage_settings'));
--> statement-breakpoint
CREATE POLICY integration_connections_update ON "integrations"."integration_connections"
  FOR UPDATE TO authenticated
  USING (app.current_user_has_permission(organization_id, 'organization', 'manage_settings'))
  WITH CHECK (app.current_user_has_permission(organization_id, 'organization', 'manage_settings'));
--> statement-breakpoint
CREATE TRIGGER audit_integration_connections
  AFTER INSERT OR UPDATE ON "integrations"."integration_connections"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
--> statement-breakpoint

-- integrations.sync_records: Admin/Owner read-only visibility; written
-- exclusively by the Worker (see header comment).
ALTER TABLE "integrations"."sync_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "integrations"."sync_records" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sync_records_select ON "integrations"."sync_records"
  FOR SELECT TO authenticated
  USING (app.current_user_has_permission(organization_id, 'organization', 'manage_settings'));
--> statement-breakpoint
CREATE TRIGGER audit_sync_records
  AFTER INSERT OR UPDATE ON "integrations"."sync_records"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_event();
