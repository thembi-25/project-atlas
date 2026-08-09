import { and, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type JobAssignment = typeof schema.jobAssignments.$inferSelect;

export async function insertJobAssignment(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    jobId: string;
    userId: string;
    assignedByUserId?: string | undefined;
  },
): Promise<JobAssignment> {
  const [assignment] = await tx
    .insert(schema.jobAssignments)
    .values({
      organizationId: input.organizationId,
      jobId: input.jobId,
      userId: input.userId,
      assignedByUserId: input.assignedByUserId ?? null,
    })
    .returning();
  if (!assignment) {
    throw new Error('Failed to insert job assignment');
  }
  return assignment;
}

export async function deleteJobAssignment(
  tx: DatabaseClient,
  jobId: string,
  userId: string,
): Promise<boolean> {
  const deleted = await tx
    .delete(schema.jobAssignments)
    .where(and(eq(schema.jobAssignments.jobId, jobId), eq(schema.jobAssignments.userId, userId)))
    .returning();
  return deleted.length > 0;
}

export async function listJobAssignments(
  tx: DatabaseClient,
  jobId: string,
): Promise<JobAssignment[]> {
  return tx.select().from(schema.jobAssignments).where(eq(schema.jobAssignments.jobId, jobId));
}

export async function isUserAssignedToJob(
  tx: DatabaseClient,
  jobId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: schema.jobAssignments.id })
    .from(schema.jobAssignments)
    .where(and(eq(schema.jobAssignments.jobId, jobId), eq(schema.jobAssignments.userId, userId)))
    .limit(1);
  return row !== undefined;
}
