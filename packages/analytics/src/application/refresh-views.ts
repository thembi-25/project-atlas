import { sql } from 'drizzle-orm';
import { withServiceContext, type DatabaseClient } from '@atlas/database';
import {
  recordFailedRefresh,
  recordSuccessfulRefresh,
  type RefreshedViewName,
} from '../infrastructure/refresh-log';

const REFRESHABLE_VIEWS: RefreshedViewName[] = [
  'mv_revenue_by_period',
  'mv_job_volume_by_type',
  'mv_technician_utilization',
  'mv_invoice_aging',
];

export interface RefreshViewOutcome {
  viewName: RefreshedViewName;
  succeeded: boolean;
  error?: string;
}

/**
 * Refreshes each of the four materialized views independently — rather
 * than via the combined `analytics.refresh_all_materialized_views()` SQL
 * function from migration 0029 — so one view's failure doesn't prevent
 * recording the others' successful refresh time. analytics-prd.md §17's
 * "must show the last-known staleness timestamp accurately" requirement
 * needs that per-view granularity, which the combined function's single
 * all-or-nothing transaction can't provide. `viewName` is always one of
 * the four hardcoded literals above, never request-derived, so building
 * the identifier via `sql.identifier` (not a bind parameter — Postgres
 * doesn't allow parameterized identifiers) carries no injection risk.
 *
 * The `REFRESH MATERIALIZED VIEW CONCURRENTLY` statement itself is issued
 * directly on `db` (autocommit), never inside `withServiceContext`'s
 * `db.transaction(...)` wrapper — Postgres rejects
 * `REFRESH ... CONCURRENTLY` inside an explicit transaction block
 * ("cannot be executed inside a transaction block"), since it manages
 * multiple internal sub-transactions itself. It needs no
 * `SET LOCAL role`/actor-attribution context either (no audit trigger
 * exists on a materialized view). `withServiceContext` is used only for
 * the plain-table log write afterward.
 *
 * Called by the Worker's scheduled job
 * (apps/worker/src/handlers/analytics-refresh.ts).
 */
export async function refreshAllMaterializedViews(db: DatabaseClient): Promise<RefreshViewOutcome[]> {
  const outcomes: RefreshViewOutcome[] = [];
  for (const viewName of REFRESHABLE_VIEWS) {
    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.${sql.identifier(viewName)}`);
      await withServiceContext(db, (tx) => recordSuccessfulRefresh(tx, viewName));
      outcomes.push({ viewName, succeeded: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await withServiceContext(db, (tx) => recordFailedRefresh(tx, viewName, message));
      outcomes.push({ viewName, succeeded: false, error: message });
    }
  }
  return outcomes;
}
