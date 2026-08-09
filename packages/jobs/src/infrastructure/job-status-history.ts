import { asc, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { JobStatus } from '../domain/lifecycle';

export type JobStatusHistoryEntry = typeof schema.jobStatusHistory.$inferSelect;

export async function insertJobStatusHistory(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    jobId: string;
    fromStatus: JobStatus | null;
    toStatus: JobStatus;
    reason?: string | undefined;
    changedByUserId?: string | undefined;
  },
): Promise<JobStatusHistoryEntry> {
  const [entry] = await tx
    .insert(schema.jobStatusHistory)
    .values({
      organizationId: input.organizationId,
      jobId: input.jobId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason ?? null,
      changedByUserId: input.changedByUserId ?? null,
    })
    .returning();
  if (!entry) {
    throw new Error('Failed to insert job status history entry');
  }
  return entry;
}

export async function listJobStatusHistory(
  tx: DatabaseClient,
  jobId: string,
): Promise<JobStatusHistoryEntry[]> {
  return tx
    .select()
    .from(schema.jobStatusHistory)
    .where(eq(schema.jobStatusHistory.jobId, jobId))
    .orderBy(asc(schema.jobStatusHistory.createdAt));
}
