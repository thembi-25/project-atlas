import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findJobById } from '@atlas/jobs';
import { NotFoundError } from '../domain/errors';
import { listJobPartsForJob, type JobPart } from '../infrastructure/job-parts';
import { requireInventoryConsumeAccess } from './authorize';

export interface ListJobPartsParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

/**
 * Mirrors job_parts_select's RLS policy (migration 0025): `inventory:read`
 * sees every Job's parts; an actor holding only `inventory:consume`
 * (Technician) sees only Jobs they're assigned to — the same
 * app-layer-plus-RLS defense-in-depth as every other list endpoint in
 * this codebase (see docs/03-domain/permissions.md, "Enforcement points").
 */
export async function listJobParts(
  db: DatabaseClient,
  params: ListJobPartsParams,
): Promise<JobPart[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryConsumeAccess(tx, params);
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    return listJobPartsForJob(tx, params.organizationId, params.jobId);
  });
}
