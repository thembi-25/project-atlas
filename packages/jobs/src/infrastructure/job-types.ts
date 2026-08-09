import { and, eq, isNull, or } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type JobType = typeof schema.jobTypes.$inferSelect;

/**
 * Platform defaults (`organization_id IS NULL`) plus this Organization's
 * own extensions — domain-overview.md's trade-agnostic configuration
 * pattern, mirroring @atlas/assets's `listAssetTypesForOrganization`
 * exactly. Org-authored custom Job Types are not create/update-able
 * this sprint (see SPRINT-4-COMPLETION-REPORT.md, "Known Limitations");
 * this is a read-only catalog listing.
 */
export async function listJobTypesForOrganization(
  tx: DatabaseClient,
  organizationId: string,
): Promise<JobType[]> {
  return tx
    .select()
    .from(schema.jobTypes)
    .where(
      and(
        or(
          isNull(schema.jobTypes.organizationId),
          eq(schema.jobTypes.organizationId, organizationId),
        ),
        eq(schema.jobTypes.isActive, true),
      ),
    )
    .orderBy(schema.jobTypes.name);
}

export async function findJobTypeById(
  tx: DatabaseClient,
  jobTypeId: string,
): Promise<JobType | undefined> {
  const [jobType] = await tx
    .select()
    .from(schema.jobTypes)
    .where(eq(schema.jobTypes.id, jobTypeId))
    .limit(1);
  return jobType;
}

/** True when the Job Type is a platform default or belongs to this Organization. */
export function jobTypeVisibleToOrganization(jobType: JobType, organizationId: string): boolean {
  return jobType.organizationId === null || jobType.organizationId === organizationId;
}
