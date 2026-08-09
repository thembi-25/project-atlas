import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@atlas/database';

/**
 * Server-authoritative, race-free sequential Job numbering — jobs.md:
 * "job_number (Organization-scoped, human-readable, sequential)". Never
 * `SELECT MAX(job_number) + 1` (race-prone under concurrent Job
 * creation — see docs/13-roadmap/sprint-4.md, "Job Numbering"). Instead:
 *
 * 1. `INSERT ... ON CONFLICT (organization_id) DO NOTHING` lazily
 *    initializes the counter row the first time an Organization creates
 *    a Job — safe under concurrent first-Job creation (Postgres blocks
 *    the losing INSERT briefly on the winner's row lock, then no-ops).
 * 2. `UPDATE ... SET next_number = next_number + 1 RETURNING
 *    next_number - 1` atomically claims and returns the number to
 *    assign. The UPDATE's row-level lock serializes concurrent callers
 *    for the same Organization, so no explicit `SELECT ... FOR UPDATE`
 *    is needed.
 *
 * Must run inside the same transaction as the Job INSERT it numbers, so
 * a rolled-back Job creation only leaves a numbering gap (the same,
 * accepted behavior as a Postgres `SERIAL`/sequence), never a duplicate.
 */
export async function allocateJobNumber(
  tx: DatabaseClient,
  organizationId: string,
): Promise<number> {
  await tx.execute(sql`
    INSERT INTO jobs.job_number_counters (organization_id, next_number)
    VALUES (${organizationId}::uuid, 1)
    ON CONFLICT (organization_id) DO NOTHING
  `);

  const rows = await tx.execute<{ assigned_number: number }>(sql`
    UPDATE jobs.job_number_counters
    SET next_number = next_number + 1
    WHERE organization_id = ${organizationId}::uuid
    RETURNING next_number - 1 AS assigned_number
  `);
  const assigned = rows[0]?.assigned_number;
  if (assigned === undefined) {
    throw new Error('Failed to allocate a Job number');
  }
  return assigned;
}
