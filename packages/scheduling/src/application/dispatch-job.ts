import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findJobById, transitionJobStatusInTx, type Job } from '@atlas/jobs';
import { JobNotDispatchableError, NotFoundError } from '../domain/errors';
import { insertDispatchEvent, type DispatchEvent } from '../infrastructure/dispatch-events';
import { requireSchedulingPermission } from './authorize';

export interface DispatchJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export interface DispatchJobResult {
  job: Job;
  dispatchEvent: DispatchEvent;
}

/**
 * dispatch.md business rule 1: "A Job can only be dispatched from
 * `scheduled` status; dispatching transitions it to `dispatched`."
 * dispatch-prd.md §12: "Dispatcher/Admin/Owner: can dispatch" — gated
 * on `scheduling:write` (mirrors `jobs:write` for the same Dispatcher/
 * Admin/Owner role set, and this action lives conceptually alongside
 * Scheduling per component-architecture.md).
 */
export async function dispatchJob(
  db: DatabaseClient,
  params: DispatchJobParams,
): Promise<DispatchJobResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireSchedulingPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'write',
    });

    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    if (job.status !== 'scheduled') {
      throw new JobNotDispatchableError(job.status);
    }

    const updatedJob = await transitionJobStatusInTx(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      jobId: params.jobId,
      toStatus: 'dispatched',
    });

    const dispatchEvent = await insertDispatchEvent(tx, {
      organizationId: params.organizationId,
      jobId: params.jobId,
      dispatchedByUserId: params.actorUserId,
    });

    return { job: updatedJob, dispatchEvent };
  });
}
