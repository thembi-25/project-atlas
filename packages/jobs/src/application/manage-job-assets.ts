import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findAssetForOrganization } from '@atlas/assets';
import { hasPermission } from '@atlas/identity';
import { NotFoundError } from '../domain/errors';
import { findJobById } from '../infrastructure/jobs';
import {
  deleteJobAsset,
  insertJobAsset,
  listJobAssets,
  type JobAsset,
} from '../infrastructure/job-assets';
import { isUserAssignedToJob } from '../infrastructure/job-assignments';
import { requireJobsPermission } from './authorize';

export interface AttachAssetToJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  assetId: string;
}

/** jobs.md relationships: "References zero or more Assets." Verifies the Asset belongs to the same Organization — "Tenant A cannot attach Tenant B's Asset to its Job." */
export async function attachAssetToJob(
  db: DatabaseClient,
  params: AttachAssetToJobParams,
): Promise<JobAsset> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'write',
    });
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const asset = await findAssetForOrganization(tx, {
      organizationId: params.organizationId,
      assetId: params.assetId,
    });
    if (!asset) {
      throw new NotFoundError('Asset');
    }
    return insertJobAsset(tx, {
      organizationId: params.organizationId,
      jobId: params.jobId,
      assetId: params.assetId,
    });
  });
}

export interface DetachAssetFromJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  assetId: string;
}

export async function detachAssetFromJob(
  db: DatabaseClient,
  params: DetachAssetFromJobParams,
): Promise<void> {
  await withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'write',
    });
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const deleted = await deleteJobAsset(tx, params.jobId, params.assetId);
    if (!deleted) {
      throw new NotFoundError('Job Asset');
    }
  });
}

export interface ListJobAssetsParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export async function listAssetsForJob(
  db: DatabaseClient,
  params: ListJobAssetsParams,
): Promise<JobAsset[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const canReadAll = await hasPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'jobs',
      action: 'read',
    });
    if (!canReadAll) {
      const canReadAssigned = await hasPermission(tx, {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        resource: 'jobs',
        action: 'read_assigned',
      });
      const assigned =
        canReadAssigned && (await isUserAssignedToJob(tx, job.id, params.actorUserId));
      if (!assigned) {
        throw new NotFoundError('Job');
      }
    }
    return listJobAssets(tx, params.jobId);
  });
}
