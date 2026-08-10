import { and, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type JobPart = typeof schema.jobParts.$inferSelect;

export async function insertJobPart(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    jobId: string;
    inventoryItemId: string;
    stockMovementId: string;
    quantity: string;
    unitCostAtTime: string;
    consumedByUserId?: string | null | undefined;
  },
): Promise<JobPart> {
  const [row] = await tx
    .insert(schema.jobParts)
    .values({
      organizationId: input.organizationId,
      jobId: input.jobId,
      inventoryItemId: input.inventoryItemId,
      stockMovementId: input.stockMovementId,
      quantity: input.quantity,
      unitCostAtTime: input.unitCostAtTime,
      consumedByUserId: input.consumedByUserId ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to record Job Part consumption.');
  return row;
}

export async function listJobPartsForJob(
  tx: DatabaseClient,
  organizationId: string,
  jobId: string,
): Promise<JobPart[]> {
  return tx
    .select()
    .from(schema.jobParts)
    .where(
      and(eq(schema.jobParts.organizationId, organizationId), eq(schema.jobParts.jobId, jobId)),
    )
    .orderBy(schema.jobParts.createdAt);
}
