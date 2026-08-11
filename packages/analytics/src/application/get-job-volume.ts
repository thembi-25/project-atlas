import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { describeStaleness, type Staleness } from '../domain/staleness';
import { queryJobVolumeByType, type JobVolumeByTypeRow } from '../infrastructure/job-volume';
import { findLastRefreshedAt } from '../infrastructure/refresh-log';
import { requireAnalyticsAccess } from './authorize';

export interface GetJobVolumeByTypeParams {
  organizationId: string;
  actorUserId: string;
}

export interface GetJobVolumeByTypeResult extends Staleness {
  rows: JobVolumeByTypeRow[];
}

/** analytics-prd.md §7 "job-volume-by-type dashboard." */
export async function getJobVolumeByType(
  db: DatabaseClient,
  params: GetJobVolumeByTypeParams,
): Promise<GetJobVolumeByTypeResult> {
  return withServiceContext(db, async (tx) => {
    await requireAnalyticsAccess(tx, params);
    const [rows, lastRefreshedAt] = await Promise.all([
      queryJobVolumeByType(tx, params.organizationId),
      findLastRefreshedAt(tx, 'mv_job_volume_by_type'),
    ]);
    return { ...describeStaleness(lastRefreshedAt, new Date()), rows };
  });
}
