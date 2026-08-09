import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { ForbiddenError, NotFoundError } from '../domain/errors';
import { listJobTypesForOrganization, type JobType } from '../infrastructure/job-types';
import {
  listServiceCategoriesForOrganization,
  type ServiceCategory,
} from '../infrastructure/service-categories';

export interface ListJobTypesParams {
  organizationId: string;
  actorUserId: string;
}

async function requireAnyJobsReadAccess(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string },
): Promise<void> {
  const membership = await findActiveMembershipByOrgAndUser(
    tx,
    params.organizationId,
    params.actorUserId,
  );
  if (!membership) {
    throw new NotFoundError('Organization');
  }
  const canRead = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'jobs',
    action: 'read',
  });
  const canReadAssigned =
    canRead ||
    (await hasPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'jobs',
      action: 'read_assigned',
    }));
  if (!canReadAssigned) {
    throw new ForbiddenError();
  }
}

/** job_types/service_categories are visible to any actor who can read Jobs at all (`jobs:read` or `jobs:read_assigned`) — see migration 0017's `job_types_select` RLS policy. */
export async function listJobTypes(
  db: DatabaseClient,
  params: ListJobTypesParams,
): Promise<JobType[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAnyJobsReadAccess(tx, params);
    return listJobTypesForOrganization(tx, params.organizationId);
  });
}

export async function listServiceCategories(
  db: DatabaseClient,
  params: ListJobTypesParams,
): Promise<ServiceCategory[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAnyJobsReadAccess(tx, params);
    return listServiceCategoriesForOrganization(tx, params.organizationId);
  });
}
