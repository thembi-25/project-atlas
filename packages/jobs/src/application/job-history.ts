import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { hasPermission } from '@atlas/identity';
import { NotFoundError } from '../domain/errors';
import { findJobById, type Job } from '../infrastructure/jobs';
import {
  isUserAssignedToJob,
  listJobAssignments,
  type JobAssignment,
} from '../infrastructure/job-assignments';
import {
  listJobStatusHistory,
  type JobStatusHistoryEntry,
} from '../infrastructure/job-status-history';
import { listTasksForJob, type Task } from '../infrastructure/tasks';

export interface GetJobHistoryParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export interface JobHistoryResult {
  job: Job;
  statusHistory: JobStatusHistoryEntry[];
  tasks: Task[];
  assignments: JobAssignment[];
}

/**
 * jobs.md's Job-detail activity view: status transitions, checklist
 * state, and current assignment — the coherent operational picture
 * jobs-prd.md §13 describes. No Estimate/Invoice/Payment section is
 * rendered (Sprint 5+ scope, not yet implemented) — see
 * SPRINT-4-COMPLETION-REPORT.md, "Known Limitations".
 */
export async function getJobHistory(
  db: DatabaseClient,
  params: GetJobHistoryParams,
): Promise<JobHistoryResult> {
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

    const [statusHistory, tasks, assignments] = await Promise.all([
      listJobStatusHistory(tx, params.jobId),
      listTasksForJob(tx, params.jobId),
      listJobAssignments(tx, params.jobId),
    ]);
    return { job, statusHistory, tasks, assignments };
  });
}
