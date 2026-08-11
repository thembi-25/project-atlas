import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

export interface TechnicianUtilizationRow {
  technicianUserId: string;
  period: string;
  scheduledHours: string;
  jobCount: number;
}

type RawRow = {
  technician_user_id: string;
  period: string;
  scheduled_hours: string;
  job_count: string;
};

/**
 * Queries `analytics.mv_technician_utilization` (migration 0029) —
 * Organization-scoped always, and additionally filtered to
 * `technicianUserIds` for the Dispatcher "own Team" scope (roles.md,
 * Role-to-module access summary) — see
 * `packages/analytics/src/application/authorize.ts`,
 * `get-technician-utilization.ts`. `undefined` means no team filter
 * (organization-wide, Owner/Admin/Accountant).
 */
export async function queryTechnicianUtilization(
  tx: DatabaseClient,
  params: { organizationId: string; technicianUserIds: string[] | undefined },
): Promise<TechnicianUtilizationRow[]> {
  // Built as an explicit `IN (...)` list of scalar-bound parameters rather
  // than `= ANY($1::uuid[])` — avoids depending on the postgres.js
  // driver's array-parameter serialization, which this sandbox has no way
  // to exercise against a live connection to verify (no raw Postgres TCP
  // egress — see docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md).
  let teamFilter = sql``;
  if (params.technicianUserIds !== undefined) {
    if (params.technicianUserIds.length === 0) {
      teamFilter = sql`AND false`;
    } else {
      const idList = sql.join(
        params.technicianUserIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      teamFilter = sql`AND technician_user_id IN (${idList})`;
    }
  }

  const rows = await tx.execute<RawRow>(sql`
    SELECT technician_user_id, period, scheduled_hours, job_count
    FROM analytics.mv_technician_utilization
    WHERE organization_id = ${params.organizationId}::uuid
    ${teamFilter}
    ORDER BY period ASC, technician_user_id ASC
  `);
  return rows.map((row) => ({
    technicianUserId: row.technician_user_id,
    period: row.period,
    scheduledHours: row.scheduled_hours,
    jobCount: Number(row.job_count),
  }));
}
