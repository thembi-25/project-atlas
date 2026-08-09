import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { ForbiddenError, JobIsImmutableError, NotFoundError } from '../domain/errors';
import { isTerminalJobStatus } from '../domain/lifecycle';
import {
  findJobById,
  listJobsForOrganization,
  searchJobs as searchJobsInfra,
  setJobDeletedAt,
  updateJobFields,
  type Job,
  type JobCursor,
  type JobPriority,
  type JobSearchHit,
  type JobSortField,
  type SortDirection,
} from '../infrastructure/jobs';
import { isUserAssignedToJob } from '../infrastructure/job-assignments';
import { requireJobsPermission } from './authorize';

async function requireJobReadAccess(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string; job: Job },
): Promise<void> {
  const canReadAll = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'jobs',
    action: 'read',
  });
  if (canReadAll) return;

  const canReadAssigned = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'jobs',
    action: 'read_assigned',
  });
  const assigned =
    canReadAssigned && (await isUserAssignedToJob(tx, params.job.id, params.actorUserId));
  if (!assigned) {
    throw new NotFoundError('Job');
  }
}

export interface GetJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export async function getJob(db: DatabaseClient, params: GetJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const membership = await findActiveMembershipByOrgAndUser(
      tx,
      params.organizationId,
      params.actorUserId,
    );
    if (!membership) {
      throw new NotFoundError('Organization');
    }
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    await requireJobReadAccess(tx, { ...params, job });
    return job;
  });
}

export interface ListJobsParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: JobCursor | undefined;
  sortField: JobSortField;
  sortDirection: SortDirection;
  status?: Job['status'] | undefined;
  priority?: JobPriority | undefined;
  customerId?: string | undefined;
  propertyId?: string | undefined;
  /** `true` restricts the listing to Jobs assigned to the caller — used by the Technician "My Jobs" view. */
  assignedToMe?: boolean | undefined;
}

export async function listJobs(
  db: DatabaseClient,
  params: ListJobsParams,
): Promise<{ rows: Job[]; hasMore: boolean }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const membership = await findActiveMembershipByOrgAndUser(
      tx,
      params.organizationId,
      params.actorUserId,
    );
    if (!membership) {
      throw new NotFoundError('Organization');
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
      if (!canReadAssigned) {
        throw new ForbiddenError();
      }
    }
    return listJobsForOrganization(tx, {
      organizationId: params.organizationId,
      limit: params.limit,
      cursor: params.cursor,
      sortField: params.sortField,
      sortDirection: params.sortDirection,
      status: params.status,
      priority: params.priority,
      customerId: params.customerId,
      propertyId: params.propertyId,
      assignedToUserId: !canReadAll || params.assignedToMe ? params.actorUserId : undefined,
    });
  });
}

export interface SearchJobsParams {
  organizationId: string;
  actorUserId: string;
  query: string;
  limit: number;
}

export async function searchJobs(
  db: DatabaseClient,
  params: SearchJobsParams,
): Promise<JobSearchHit[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'read',
    });
    return searchJobsInfra(tx, params.organizationId, params.query, params.limit);
  });
}

export interface UpdateJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  fields: {
    jobTypeId?: string | undefined;
    serviceCategoryId?: string | null | undefined;
    priority?: JobPriority | undefined;
    contactId?: string | null | undefined;
    description?: string | null | undefined;
  };
}

/** Ordinary field edits — never `status` (see @atlas/jobs's transition functions) or `customerId`/`propertyId`. Blocked once the Job is terminal (jobs.md business rule 4). */
export async function updateJob(db: DatabaseClient, params: UpdateJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }

    const hasWrite = await hasPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'jobs',
      action: 'write',
    });
    if (!hasWrite) {
      const hasWriteAssigned = await hasPermission(tx, {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        resource: 'jobs',
        action: 'write_assigned',
      });
      const assigned =
        hasWriteAssigned && (await isUserAssignedToJob(tx, job.id, params.actorUserId));
      if (!assigned) {
        throw new NotFoundError('Job');
      }
    }

    if (isTerminalJobStatus(job.status)) {
      throw new JobIsImmutableError();
    }

    const updated = await updateJobFields(tx, params.jobId, params.fields);
    if (!updated) {
      throw new NotFoundError('Job');
    }
    return updated;
  });
}

export interface ArchiveJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export async function archiveJob(db: DatabaseClient, params: ArchiveJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'delete',
    });
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const updated = await setJobDeletedAt(tx, params.jobId, new Date());
    if (!updated) {
      throw new NotFoundError('Job');
    }
    return updated;
  });
}

export interface RestoreJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export async function restoreJob(db: DatabaseClient, params: RestoreJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'delete',
    });
    const job = await findJobById(tx, params.jobId, { includeDeleted: true });
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const updated = await setJobDeletedAt(tx, params.jobId, null);
    if (!updated) {
      throw new NotFoundError('Job');
    }
    return updated;
  });
}
