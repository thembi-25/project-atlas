import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { findJobById } from '@atlas/jobs';
import { NotFoundError } from '../domain/errors';
import {
  findSchedulingConflicts,
  findScheduleEventByJobId,
  listScheduleEventsForOrganization,
  type ScheduleConflict,
  type ScheduleEvent,
} from '../infrastructure/schedule-events';

export interface ListScheduleParams {
  organizationId: string;
  actorUserId: string;
  start: Date;
  end: Date;
  teamId?: string | undefined;
}

/**
 * scheduling-prd.md §11: `GET /api/v1/schedule?start=...&end=...&team_id=...`.
 * scheduling.md, "Permission requirements": Dispatcher/Admin/Owner see
 * the full board; a Technician (`scheduling:read_assigned`) sees only
 * their own Schedule Events.
 */
export async function listSchedule(
  db: DatabaseClient,
  params: ListScheduleParams,
): Promise<ScheduleEvent[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const membership = await findActiveMembershipByOrgAndUser(
      tx,
      params.organizationId,
      params.actorUserId,
    );
    if (!membership) {
      throw new NotFoundError('Organization');
    }
    const canReadAll =
      (await hasPermission(tx, {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        resource: 'scheduling',
        action: 'write',
      })) ||
      (await hasPermission(tx, {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        resource: 'scheduling',
        action: 'read',
      }));

    return listScheduleEventsForOrganization(tx, {
      organizationId: params.organizationId,
      start: params.start,
      end: params.end,
      teamId: params.teamId,
      userId: canReadAll ? undefined : params.actorUserId,
    });
  });
}

export interface GetJobScheduleParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export async function getJobSchedule(
  db: DatabaseClient,
  params: GetJobScheduleParams,
): Promise<ScheduleEvent | undefined> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    return findScheduleEventByJobId(tx, params.jobId);
  });
}

export interface GetConflictsParams {
  organizationId: string;
  actorUserId: string;
  userIds: string[];
  start: Date;
  end: Date;
}

/** scheduling-prd.md §11: `GET /api/v1/schedule/conflicts?user_id=...&start=...&end=...`. */
export async function getConflicts(
  db: DatabaseClient,
  params: GetConflictsParams,
): Promise<ScheduleConflict[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const membership = await findActiveMembershipByOrgAndUser(
      tx,
      params.organizationId,
      params.actorUserId,
    );
    if (!membership) {
      throw new NotFoundError('Organization');
    }
    return findSchedulingConflicts(tx, {
      organizationId: params.organizationId,
      userIds: params.userIds,
      scheduledStart: params.start,
      scheduledEnd: params.end,
    });
  });
}
