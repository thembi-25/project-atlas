import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { describeStaleness, type Staleness } from '../domain/staleness';
import {
  queryTechnicianUtilization,
  type TechnicianUtilizationRow,
} from '../infrastructure/technician-utilization';
import { findLastRefreshedAt } from '../infrastructure/refresh-log';
import { requireAnalyticsAccess, resolveTechnicianScope } from './authorize';

export interface GetTechnicianUtilizationParams {
  organizationId: string;
  actorUserId: string;
}

export interface GetTechnicianUtilizationResult extends Staleness {
  scope: 'organization' | 'team';
  rows: TechnicianUtilizationRow[];
}

/**
 * analytics-prd.md §7 "technician-utilization dashboard" — the one widget
 * genuinely Team-scoped for a Dispatcher (see `authorize.ts`,
 * `resolveTechnicianScope`).
 */
export async function getTechnicianUtilization(
  db: DatabaseClient,
  params: GetTechnicianUtilizationParams,
): Promise<GetTechnicianUtilizationResult> {
  return withServiceContext(db, async (tx) => {
    const scope = await requireAnalyticsAccess(tx, params);
    const technicianUserIds = await resolveTechnicianScope(tx, { ...params, scope });
    const [rows, lastRefreshedAt] = await Promise.all([
      queryTechnicianUtilization(tx, { organizationId: params.organizationId, technicianUserIds }),
      findLastRefreshedAt(tx, 'mv_technician_utilization'),
    ]);
    return { ...describeStaleness(lastRefreshedAt, new Date()), scope, rows };
  });
}
