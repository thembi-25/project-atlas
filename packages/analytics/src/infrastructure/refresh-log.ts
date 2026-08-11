import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

export type RefreshedViewName =
  | 'mv_revenue_by_period'
  | 'mv_job_volume_by_type'
  | 'mv_technician_utilization'
  | 'mv_invoice_aging';

type ViewRefreshLogRow = {
  last_refreshed_at: string | null;
};

/** Reads `analytics.view_refresh_log` (migration 0030) for one view's last successful refresh time. */
export async function findLastRefreshedAt(
  tx: DatabaseClient,
  viewName: RefreshedViewName,
): Promise<Date | null> {
  const rows = await tx.execute<ViewRefreshLogRow>(sql`
    SELECT last_refreshed_at
    FROM analytics.view_refresh_log
    WHERE view_name = ${viewName}
  `);
  const row = rows[0];
  return row?.last_refreshed_at ? new Date(row.last_refreshed_at) : null;
}

/**
 * Called by the Worker's scheduled refresh job
 * (apps/worker/src/handlers/analytics-refresh.ts) after
 * `analytics.refresh_all_materialized_views()` succeeds — records the
 * successful refresh time per view so `findLastRefreshedAt` reflects it.
 */
export async function recordSuccessfulRefresh(tx: DatabaseClient, viewName: RefreshedViewName): Promise<void> {
  await tx.execute(sql`
    UPDATE analytics.view_refresh_log
    SET last_refreshed_at = now(), last_attempted_at = now(), last_error = NULL
    WHERE view_name = ${viewName}
  `);
}

/**
 * Called when a refresh attempt fails — analytics-prd.md §17: staleness
 * must reflect the last *successful* refresh, so `last_refreshed_at` is
 * deliberately left untouched; only the attempt/error bookkeeping updates.
 */
export async function recordFailedRefresh(
  tx: DatabaseClient,
  viewName: RefreshedViewName,
  errorMessage: string,
): Promise<void> {
  await tx.execute(sql`
    UPDATE analytics.view_refresh_log
    SET last_attempted_at = now(), last_error = ${errorMessage}
    WHERE view_name = ${viewName}
  `);
}
