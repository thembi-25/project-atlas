import { recordDomainEvent, withRequestContext, type DatabaseClient } from '@atlas/database';
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
 *
 * Emits `job.dispatched` to the transactional outbox (ADR-011) in the
 * same transaction as the status write, mirroring `@atlas/jobs`'s
 * `completeJob`/`job.completed` emission exactly. Sprint 5's dispatcher
 * deliberately left this event unemitted ("no consumer justifies it
 * yet" — docs/13-roadmap/sprint-5.md); Sprint 7's Notifications module is
 * the first real consumer (event-driven-architecture.md's catalog: "SMS/
 * email to Technician and Customer"), so it's added now. The Worker
 * resolves the actual Technician/Customer recipients from `dispatchEvent`/
 * `job.customerId` — this payload only needs to identify the Job.
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

    await recordDomainEvent(tx, {
      organizationId: params.organizationId,
      eventType: 'job.dispatched',
      entityType: 'jobs.jobs',
      entityId: updatedJob.id,
      payload: { jobId: updatedJob.id, customerId: updatedJob.customerId },
    });

    return { job: updatedJob, dispatchEvent };
  });
}
