import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { NotFoundError } from '../domain/errors';
import { findJobById } from '../infrastructure/jobs';
import {
  deleteJobAssignment,
  insertJobAssignment,
  isUserAssignedToJob,
  listJobAssignments,
  type JobAssignment,
} from '../infrastructure/job-assignments';
import { requireJobsPermission } from './authorize';

export interface AssignUserToJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  userId: string;
}

/**
 * jobs-prd.md's `jobs:assign` Permission (Dispatcher/Admin/Owner only).
 * Verifies the target User holds an active Membership in the same
 * Organization before assigning — "Tenant A cannot assign Tenant B's
 * Technician" (docs/07-security/tenant-isolation.md), defense-in-depth
 * alongside the database's own RLS `WITH CHECK`. No Role restriction
 * beyond active Membership is documented (docs/03-domain/technicians.md
 * describes what a Technician is, not that only Technicians may be
 * assigned) — see SPRINT-4-COMPLETION-REPORT.md, "Deviations From
 * Documentation".
 */
export async function assignUserToJob(
  db: DatabaseClient,
  params: AssignUserToJobParams,
): Promise<JobAssignment> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'assign',
    });
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const targetMembership = await findActiveMembershipByOrgAndUser(
      tx,
      params.organizationId,
      params.userId,
    );
    if (!targetMembership) {
      throw new NotFoundError('User');
    }
    return insertJobAssignment(tx, {
      organizationId: params.organizationId,
      jobId: params.jobId,
      userId: params.userId,
      assignedByUserId: params.actorUserId,
    });
  });
}

export interface UnassignUserFromJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  userId: string;
}

export async function unassignUserFromJob(
  db: DatabaseClient,
  params: UnassignUserFromJobParams,
): Promise<void> {
  await withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'assign',
    });
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const deleted = await deleteJobAssignment(tx, params.jobId, params.userId);
    if (!deleted) {
      throw new NotFoundError('Assignment');
    }
  });
}

export interface ListJobAssignmentsParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export async function listAssignmentsForJob(
  db: DatabaseClient,
  params: ListJobAssignmentsParams,
): Promise<JobAssignment[]> {
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
    return listJobAssignments(tx, params.jobId);
  });
}
