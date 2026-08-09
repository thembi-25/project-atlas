import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser } from '@atlas/identity';
import { findJobById, transitionJobStatusInTx, type Job } from '@atlas/jobs';
import {
  InvalidScheduleWindowError,
  JobNotSchedulableError,
  NotFoundError,
} from '../domain/errors';
import {
  findScheduleEventByJobId,
  findSchedulingConflicts,
  insertScheduleEvent,
  insertScheduleEventAssignment,
  type ScheduleConflict,
  type ScheduleEvent,
} from '../infrastructure/schedule-events';
import { requireSchedulingPermission } from './authorize';

export interface ScheduleJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  userIds: string[];
  teamId?: string | undefined;
  notes?: string | undefined;
}

export interface ScheduleJobResult {
  scheduleEvent: ScheduleEvent;
  job: Job;
  conflicts: ScheduleConflict[];
}

/**
 * scheduling.md business rule 1: "Scheduling a Job requires the Job to
 * be in `draft` or `scheduled` status... and transitions it to
 * `scheduled`." A Job with an existing `schedule_event` (already
 * `scheduled`) is handled here too — creating the first schedule for a
 * Job in `draft` uses this path; changing an existing one uses
 * `rescheduleJob` instead (see that function's docstring for why they
 * are split).
 */
export async function scheduleJob(
  db: DatabaseClient,
  params: ScheduleJobParams,
): Promise<ScheduleJobResult> {
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
    if (job.status !== 'draft' && job.status !== 'scheduled') {
      throw new JobNotSchedulableError(job.status);
    }

    const existing = await findScheduleEventByJobId(tx, params.jobId);
    if (existing) {
      throw new JobNotSchedulableError(job.status);
    }

    for (const userId of params.userIds) {
      const membership = await findActiveMembershipByOrgAndUser(tx, params.organizationId, userId);
      if (!membership) {
        throw new NotFoundError('User');
      }
    }

    const conflicts = await findSchedulingConflicts(tx, {
      organizationId: params.organizationId,
      userIds: params.userIds,
      scheduledStart: params.scheduledStart,
      scheduledEnd: params.scheduledEnd,
    });

    const scheduleEvent = await insertScheduleEvent(tx, {
      organizationId: params.organizationId,
      jobId: params.jobId,
      scheduledStart: params.scheduledStart,
      scheduledEnd: params.scheduledEnd,
      teamId: params.teamId,
      notes: params.notes,
    });

    for (const userId of params.userIds) {
      await insertScheduleEventAssignment(tx, {
        organizationId: params.organizationId,
        scheduleEventId: scheduleEvent.id,
        userId,
      });
    }

    const updatedJob =
      job.status === 'draft'
        ? await transitionJobStatusInTx(tx, {
            organizationId: params.organizationId,
            actorUserId: params.actorUserId,
            jobId: params.jobId,
            toStatus: 'scheduled',
          })
        : job;

    return { scheduleEvent, job: updatedJob, conflicts };
  });
}
