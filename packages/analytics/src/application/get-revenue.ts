import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { describeStaleness, type Staleness } from '../domain/staleness';
import { queryRevenueByPeriod, type RevenueByPeriodRow } from '../infrastructure/revenue';
import { findLastRefreshedAt } from '../infrastructure/refresh-log';
import { requireAnalyticsAccess } from './authorize';

export interface GetRevenueByPeriodParams {
  organizationId: string;
  actorUserId: string;
}

export interface GetRevenueByPeriodResult extends Staleness {
  rows: RevenueByPeriodRow[];
}

/**
 * analytics-prd.md §7 "Revenue-by-period dashboard." Runs under
 * `withServiceContext` — see migration 0029's header comment: a
 * materialized view cannot carry RLS, so the permission check and the
 * `organizationId` scoping below are the entire enforcement, done
 * explicitly rather than relying on the (nonexistent) RLS policy.
 */
export async function getRevenueByPeriod(
  db: DatabaseClient,
  params: GetRevenueByPeriodParams,
): Promise<GetRevenueByPeriodResult> {
  return withServiceContext(db, async (tx) => {
    await requireAnalyticsAccess(tx, params);
    const [rows, lastRefreshedAt] = await Promise.all([
      queryRevenueByPeriod(tx, params.organizationId),
      findLastRefreshedAt(tx, 'mv_revenue_by_period'),
    ]);
    return { ...describeStaleness(lastRefreshedAt, new Date()), rows };
  });
}
