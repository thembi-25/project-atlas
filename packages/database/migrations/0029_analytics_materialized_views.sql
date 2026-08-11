-- Analytics (Sprint 7): the four materialized views named explicitly in
-- docs/03-domain/analytics.md's Data requirements, refreshed by a new
-- scheduled Worker job rather than per-event (materialized views are
-- documented as schedule-refreshed, never push-updated — see
-- docs/06-modules/analytics-prd.md §10). See docs/13-roadmap/sprint-7.md.
--
-- Postgres materialized views cannot carry RLS policies (CREATE POLICY
-- only targets ordinary tables/views, never a materialized view) — so
-- these are NOT queried through `withRequestContext`'s `authenticated`
-- role at all. @atlas/analytics's read functions run exclusively under
-- `withServiceContext` (the connection's own elevated privileges,
-- bypassing RLS entirely — see packages/database/src/request-context.ts)
-- and do their OWN application-layer permission check
-- (`requireAnalyticsPermission`, reusing the pre-seeded
-- `reports:read_own_team`/`read_organization` Permission) plus an
-- explicit `WHERE organization_id = :organizationId` filter bound from
-- authenticated context, never from client input. This is the same
-- "escape hatch, narrowly reviewed and justified" pattern
-- request-context.ts documents for Sprint 1's create-organization/
-- accept-invitation — here it is not a convenience shortcut but the only
-- mechanism available, since RLS structurally cannot apply to a
-- materialized view. To make this safe even if a future caller
-- forgets and connects as `authenticated`, SELECT is explicitly revoked
-- from `anon`/`authenticated`/`PUBLIC` on every view below — only the
-- connection-owning role (never switched away from by
-- `withServiceContext`) can read them at all.

CREATE SCHEMA "analytics";
--> statement-breakpoint

-- mv_revenue_by_period — analytics-prd.md §7 "Revenue-by-period
-- dashboard." Net revenue (captures minus refunds) per Organization per
-- day, derived from completed Payments only.
CREATE MATERIALIZED VIEW "analytics"."mv_revenue_by_period" AS
SELECT
  organization_id,
  date_trunc('day', completed_at) AS period,
  SUM(amount) AS total_revenue,
  COUNT(*) AS payment_count
FROM financials.payments
WHERE status = 'completed' AND completed_at IS NOT NULL
GROUP BY organization_id, date_trunc('day', completed_at);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mv_revenue_by_period" ON "analytics"."mv_revenue_by_period" (organization_id, period);
--> statement-breakpoint
REVOKE ALL ON "analytics"."mv_revenue_by_period" FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- mv_job_volume_by_type — analytics-prd.md §7 "job-volume-by-type
-- dashboard."
CREATE MATERIALIZED VIEW "analytics"."mv_job_volume_by_type" AS
SELECT
  organization_id,
  job_type_id,
  status,
  COUNT(*) AS job_count
FROM jobs.jobs
GROUP BY organization_id, job_type_id, status;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mv_job_volume_by_type" ON "analytics"."mv_job_volume_by_type" (organization_id, job_type_id, status);
--> statement-breakpoint
REVOKE ALL ON "analytics"."mv_job_volume_by_type" FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- mv_technician_utilization — analytics-prd.md §7 "technician-utilization
-- dashboard." Scoped to *scheduled hours per Technician per week* — no
-- capacity/availability data model exists anywhere in this codebase to
-- compute a true "scheduled vs. available" percentage (documented as a
-- deliberate simplification in the Sprint 7 completion report, Known
-- Limitations).
CREATE MATERIALIZED VIEW "analytics"."mv_technician_utilization" AS
SELECT
  sea.user_id AS technician_user_id,
  se.organization_id,
  date_trunc('week', se.scheduled_start) AS period,
  SUM(EXTRACT(EPOCH FROM (se.scheduled_end - se.scheduled_start)) / 3600.0) AS scheduled_hours,
  COUNT(DISTINCT se.job_id) AS job_count
FROM jobs.schedule_events se
JOIN jobs.schedule_event_assignments sea ON sea.schedule_event_id = se.id
GROUP BY sea.user_id, se.organization_id, date_trunc('week', se.scheduled_start);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mv_technician_utilization" ON "analytics"."mv_technician_utilization" (technician_user_id, organization_id, period);
--> statement-breakpoint
REVOKE ALL ON "analytics"."mv_technician_utilization" FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- mv_invoice_aging — analytics-prd.md §7 "invoice-aging dashboard."
-- `balance_due`/`days_overdue` are computed at refresh time, mirroring
-- (not duplicating the source of truth for) the same
-- amount_paid/balance_due logic @atlas/financials computes live —
-- analytics.md business rule 3 requires this to always reconcile exactly
-- against a direct aggregate query.
CREATE MATERIALIZED VIEW "analytics"."mv_invoice_aging" AS
SELECT
  i.id AS invoice_id,
  i.organization_id,
  i.invoice_number,
  i.customer_id,
  i.status,
  i.total,
  i.due_date,
  COALESCE(p.amount_paid, 0) AS amount_paid,
  i.total - COALESCE(p.amount_paid, 0) AS balance_due,
  GREATEST(0, EXTRACT(DAY FROM (now() - i.due_date))::int) AS days_overdue
FROM financials.invoices i
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS amount_paid
  FROM financials.payments
  WHERE invoice_id = i.id AND status <> 'failed'
) p ON true
WHERE i.status IN ('finalized', 'sent', 'partially_paid')
  AND i.due_date IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mv_invoice_aging" ON "analytics"."mv_invoice_aging" (invoice_id);
--> statement-breakpoint
REVOKE ALL ON "analytics"."mv_invoice_aging" FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- Refresh function — called by the Worker's scheduled job
-- (apps/worker/src/analytics-refresh.ts). CONCURRENTLY requires the
-- unique indexes created above; avoids blocking concurrent SELECTs
-- during refresh.
CREATE OR REPLACE FUNCTION analytics.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_revenue_by_period;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_job_volume_by_type;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_technician_utilization;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_invoice_aging;
END;
$$;
