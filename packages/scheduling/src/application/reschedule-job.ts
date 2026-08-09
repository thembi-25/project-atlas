import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser } from '@atlas/identity';
import { findJobById } from '@atlas/jobs';
import {
  InvalidScheduleWindowError,
  JobNotSchedulableError,
  NotFoundError,
  RescheduleReasonRequiredError,
} from '../domain/errors';
import {
  deleteScheduleEventAssignmentsForEvent,
  findScheduleEventByJobId,
  findSchedulingConflicts,
  insertScheduleEventAssignment,
  insertScheduleEventHistory,
  listScheduleEventAssignments,
  updateScheduleEventWindow,
  type ScheduleConflict,
  type ScheduleEvent,
} from '../infrastructure/schedule-events';
import { requireSchedulingPermission } from './authorize';

export interface RescheduleJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  userIds?: string[] | undefined;
  teamId?: string | null | undefined;
  reason?: string | undefined;
}

export interface RescheduleJobResult {
  scheduleEvent: ScheduleEvent;
  conflicts: ScheduleConflict[];
}

/**
 * scheduling.md business rule 1: "rescheduling updates it and logs
 * history rather than creating a competing record." Business rule 3:
 * "Rescheduling a `dispatched` or `in_progress` Job requires an
 * explicit reason." Reassigning Technicians is optional (`userIds`
 * omitted keeps the current assignment set) — this is purely a
 * time-window (and, optionally, crew) change; it does not touch
 * `job.status` (unlike `scheduleJob`, which transitions `draft` ->
 * `scheduled` on first scheduling).
 */
export async function rescheduleJob(
  db: DatabaseClient,
  params: RescheduleJobParams,
): Promise<RescheduleJobResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireSchedulingPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'write',
    });

    if (params.scheduledEnd <= params.scheduledStart) {
      throw new InvalidScheduleWindowError();
    }

    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new JobNotSchedulableError(job.status);
    }
    if ((job.status === 'dispatched' || job.status === 'in_progress') && !params.reason) {
      throw new RescheduleReasonRequiredError();
    }

    const existing = await findScheduleEventByJobId(tx, params.jobId);
    if (!existing) {
      throw new NotFoundError('Schedule Event');
    }

    const userIds = params.userIds;
    if (userIds) {
      for (const userId of userIds) {
        const membership = await findActiveMembershipByOrgAndUser(
          tx,
          params.organizationId,
          userId,
        );
        if (!membership) {
          throw new NotFoundError('User');
        }
      }
    }

    const conflicts = await findSchedulingConflicts(tx, {
      organizationId: params.organizationId,
      userIds:
        userIds ?? (await listScheduleEventAssignments(tx, existing.id)).map((a) => a.userId),
      scheduledStart: params.scheduledStart,
      scheduledEnd: params.scheduledEnd,
      excludeScheduleEventId: existing.id,
    });

    await insertScheduleEventHistory(tx, {
      organizationId: params.organizationId,
      scheduleEventId: existing.id,
      jobId: params.jobId,
      previousStart: existing.scheduledStart,
      previousEnd: existing.scheduledEnd,
      reason: params.reason,
      changedByUserId: params.actorUserId,
    });

    const updated = await updateScheduleEventWindow(tx, existing.id, {
      scheduledStart: params.scheduledStart,
      scheduledEnd: params.scheduledEnd,
      teamId: params.teamId,
    });
    if (!updated) {
      throw new NotFoundError('Schedule Event');
    }

    if (userIds) {
      await deleteScheduleEventAssignmentsForEvent(tx, existing.id);
      for (const userId of userIds) {
        await insertScheduleEventAssignment(tx, {
          organizationId: params.organizationId,
          scheduleEventId: existing.id,
          userId,
        });
      }
    }

    return { scheduleEvent: updated, conflicts };
  });
}
