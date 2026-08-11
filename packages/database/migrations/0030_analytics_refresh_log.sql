-- Analytics (Sprint 7): staleness tracking for the four materialized
-- views. Postgres has no built-in "last refreshed" timestamp for a
-- materialized view, and analytics-prd.md §13/§17 requires the UI to
-- surface an accurate "data as of HH:MM" indicator — including staying
-- accurate (showing the *last successful* refresh time, not silently
-- looking current) when a scheduled refresh fails or is delayed. This
-- ordinary table (not a materialized view, so it CAN carry RLS) is
-- updated by the Worker's scheduled refresh job
-- (apps/worker/src/handlers/analytics-refresh.ts) immediately after each
-- `analytics.refresh_all_materialized_views()` call.
--
-- No RLS policies are defined at all — this is an internal Worker-only
-- record, the same "no client-writable resource" pattern as
-- `jobs.job_number_counters` and `notifications.notifications` (migration
-- 0028's header comment). ENABLE+FORCE ROW LEVEL SECURITY with zero
-- policies denies every `authenticated`-role access outright; the
-- `REVOKE ALL` below is redundant defense-in-depth, matching the four
-- materialized views' own treatment in migration 0029.
CREATE TABLE "analytics"."view_refresh_log" (
  "view_name" text PRIMARY KEY,
  "last_refreshed_at" timestamp with time zone,
  "last_attempted_at" timestamp with time zone,
  "last_error" text
);
--> statement-breakpoint
INSERT INTO "analytics"."view_refresh_log" ("view_name") VALUES
  ('mv_revenue_by_period'),
  ('mv_job_volume_by_type'),
  ('mv_technician_utilization'),
  ('mv_invoice_aging');
--> statement-breakpoint
ALTER TABLE "analytics"."view_refresh_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "analytics"."view_refresh_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "analytics"."view_refresh_log" FROM PUBLIC, anon, authenticated;
