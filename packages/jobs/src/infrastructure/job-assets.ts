import { and, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type JobAsset = typeof schema.jobAssets.$inferSelect;

export async function insertJobAsset(
  tx: DatabaseClient,
  input: { organizationId: string; jobId: string; assetId: string },
): Promise<JobAsset> {
  const [jobAsset] = await tx
    .insert(schema.jobAssets)
    .values({ organizationId: input.organizationId, jobId: input.jobId, assetId: input.assetId })
    .returning();
  if (!jobAsset) {
    throw new Error('Failed to insert job asset link');
  }
  return jobAsset;
}

export async function deleteJobAsset(
  tx: DatabaseClient,
  jobId: string,
  assetId: string,
): Promise<boolean> {
  const deleted = await tx
    .delete(schema.jobAssets)
    .where(and(eq(schema.jobAssets.jobId, jobId), eq(schema.jobAssets.assetId, assetId)))
    .returning();
  return deleted.length > 0;
}

export async function listJobAssets(tx: DatabaseClient, jobId: string): Promise<JobAsset[]> {
  return tx.select().from(schema.jobAssets).where(eq(schema.jobAssets.jobId, jobId));
}
