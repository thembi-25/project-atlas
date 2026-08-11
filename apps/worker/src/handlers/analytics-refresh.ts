import type { DatabaseClient } from '@atlas/database';
import { refreshAllMaterializedViews } from '@atlas/analytics';
import { logger } from '../logger';

/**
 * Scheduled materialized-view refresh — analytics.md business rule 2/
 * analytics-prd.md §10: "refreshed by a new scheduled Worker job," never
 * push-updated per event (a materialized view refresh is a coarse,
 * whole-table operation — refreshing it on every one of the many events
 * that touch Jobs/Invoices/Payments would be far more refresh work than
 * a fixed schedule, for a "weekly-glance dashboard" that doesn't need
 * per-event freshness). Called from `index.ts` on a fixed interval,
 * mirroring the domain-events/Stripe-webhook poll loops.
 */
export async function runAnalyticsRefresh(db: DatabaseClient): Promise<void> {
  const outcomes = await refreshAllMaterializedViews(db);
  for (const outcome of outcomes) {
    if (outcome.succeeded) {
      logger.info('Analytics materialized view refreshed', { viewName: outcome.viewName });
    } else {
      logger.error('Analytics materialized view refresh failed', {
        viewName: outcome.viewName,
        error: outcome.error,
      });
    }
  }
}
