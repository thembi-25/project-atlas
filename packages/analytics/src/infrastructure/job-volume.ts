import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

export interface JobVolumeByTypeRow {
  jobTypeId: string;
  status: string;
  jobCount: number;
}

type RawRow = {
  job_type_id: string;
  status: string;
  job_count: string;
};

/** Queries `analytics.mv_job_volume_by_type` (migration 0029) — always Organization-scoped. */
export async function queryJobVolumeByType(
  tx: DatabaseClient,
  organizationId: string,
): Promise<JobVolumeByTypeRow[]> {
  const rows = await tx.execute<RawRow>(sql`
    SELECT job_type_id, status, job_count
    FROM analytics.mv_job_volume_by_type
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY job_type_id ASC, status ASC
  `);
  return rows.map((row) => ({
    jobTypeId: row.job_type_id,
    status: row.status,
    jobCount: Number(row.job_count),
  }));
}
