import { recordDomainEvent, withRequestContext, type DatabaseClient } from '@atlas/database';
import { findActiveMembershipByOrgAndUser, hasPermission } from '@atlas/identity';
import { canTransitionJobStatus, type JobStatus } from '../domain/lifecycle';
import {
  ForbiddenError,
  IncompleteRequiredTasksError,
  InvalidJobStateError,
  NotFoundError,
} from '../domain/errors';
import { findJobById, setJobStatus, type Job } from '../infrastructure/jobs';
import { insertJobStatusHistory } from '../infrastructure/job-status-history';
import { isUserAssignedToJob } from '../infrastructure/job-assignments';
import { listTasksForJob } from '../infrastructure/tasks';
import { requireJobsPermission } from './authorize';

export interface TransitionJobStatusParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  toStatus: JobStatus;
  reason?: string | undefined;
}

/**
 * The single, tx-composable core of every Job status transition —
 * permission check, state-machine validation (jobs.md#state-machine),
 * the actual `status` write, and the `job_status_history` append that
 * feeds Audit Events (jobs-prd.md §15). Exported (not just used
 * internally) so @atlas/scheduling can drive the Job to `scheduled`/
 * `dispatched` atomically within its own already-open transaction,
 * reusing this exact validation rather than re-implementing the state
 * machine — see packages/scheduling/src/application/schedule-job.ts and
 * dispatch-job.ts.
 */
export async function transitionJobStatusInTx(
  tx: DatabaseClient,
  params: TransitionJobStatusParams,
): Promise<Job> {
  await requireJobsPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    action: 'write',
  });
  const job = await findJobById(tx, params.jobId);
  if (!job || job.organizationId !== params.organizationId) {
    throw new NotFoundError('Job');
  }
  if (!canTransitionJobStatus(job.status, params.toStatus)) {
    throw new InvalidJobStateError(
      `Cannot transition a Job from "${job.status}" to "${params.toStatus}".`,
    );
  }

  const updated = await setJobStatus(tx, job.id, params.toStatus);
  if (!updated) {
    throw new NotFoundError('Job');
  }
  await insertJobStatusHistory(tx, {
    organizationId: params.organizationId,
    jobId: job.id,
    fromStatus: job.status,
    toStatus: params.toStatus,
    reason: params.reason,
    changedByUserId: params.actorUserId,
  });
  return updated;
}

/**
 * Same as `transitionJobStatusInTx`, but also allows a Technician
 * scoped to their own assigned Job (`jobs:write_assigned`) — used by
 * the execution-lifecycle actions a Technician performs in the field
 * (start/hold/resume/complete), per jobs-prd.md §12. Dispatch/Cancel/
 * Schedule remain Dispatcher/Admin/Owner-only via the plain
 * `transitionJobStatusInTx` above.
 */
async function transitionJobStatusScopedInTx(
  tx: DatabaseClient,
  params: TransitionJobStatusParams,
): Promise<Job> {
  const membership = await findActiveMembershipByOrgAndUser(
    tx,
    params.organizationId,
    params.actorUserId,
  );
  if (!membership) {
    throw new NotFoundError('Organization');
  }

  const hasWrite = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'jobs',
    action: 'write',
  });
  const hasWriteAssigned = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'jobs',
    action: 'write_assigned',
  });
  if (!hasWrite && !hasWriteAssigned) {
    throw new ForbiddenError();
  }

  const job = await findJobById(tx, params.jobId);
  if (!job || job.organizationId !== params.organizationId) {
    throw new NotFoundError('Job');
  }

  const allowed =
    hasWrite || (hasWriteAssigned && (await isUserAssignedToJob(tx, job.id, params.actorUserId)));
  if (!allowed) {
    throw new NotFoundError('Job');
  }

  if (!canTransitionJobStatus(job.status, params.toStatus)) {
    throw new InvalidJobStateError(
      `Cannot transition a Job from "${job.status}" to "${params.toStatus}".`,
    );
  }
  const updated = await setJobStatus(tx, job.id, params.toStatus);
  if (!updated) {
    throw new NotFoundError('Job');
  }
  await insertJobStatusHistory(tx, {
    organizationId: params.organizationId,
    jobId: job.id,
    fromStatus: job.status,
    toStatus: params.toStatus,
    reason: params.reason,
    changedByUserId: params.actorUserId,
  });
  return updated;
}

export interface StartJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

/** `dispatched` -> `in_progress` — jobs.md#state-machine: "technician starts work." Technician-assigned-scoped. */
export async function startJob(db: DatabaseClient, params: StartJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, (tx) =>
    transitionJobStatusScopedInTx(tx, { ...params, toStatus: 'in_progress' }),
  );
}

export interface HoldJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  reason?: string | undefined;
}

/** `in_progress` -> `on_hold` — jobs.md#state-machine: "paused (parts needed, customer unavailable)." Technician-assigned-scoped. */
export async function holdJob(db: DatabaseClient, params: HoldJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, (tx) =>
    transitionJobStatusScopedInTx(tx, { ...params, toStatus: 'on_hold' }),
  );
}

export interface ResumeJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

/** `on_hold` -> `in_progress` — jobs.md#state-machine: "resumed." Technician-assigned-scoped. */
export async function resumeJob(db: DatabaseClient, params: ResumeJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, (tx) =>
    transitionJobStatusScopedInTx(tx, { ...params, toStatus: 'in_progress' }),
  );
}

export interface CompleteJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

/**
 * `in_progress` -> `completed` — jobs.md business rule 3: "A Job cannot
 * be marked completed while it has any required Task incomplete."
 * Technician-assigned-scoped, per jobs-prd.md's acceptance criterion
 * (a Technician executing the Job is exactly who completes it).
 *
 * Emits `job.completed` to the transactional outbox (ADR-011) in the
 * same transaction as the status write — Sprint 5's Worker consumes this
 * to auto-generate a draft Invoice when the Job has an approved Estimate.
 * See docs/02-architecture/event-driven-architecture.md's event catalog
 * and docs/13-roadmap/sprint-5.md.
 */
export async function completeJob(db: DatabaseClient, params: CompleteJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }
    const tasks = await listTasksForJob(tx, job.id);
    const incomplete = tasks.filter((t) => t.isRequired && !t.completedAt && !t.overrideReason);
    if (incomplete.length > 0) {
      throw new IncompleteRequiredTasksError(incomplete.map((t) => t.label));
    }
    const updated = await transitionJobStatusScopedInTx(tx, { ...params, toStatus: 'completed' });

    await recordDomainEvent(tx, {
      organizationId: params.organizationId,
      eventType: 'job.completed',
      entityType: 'jobs.jobs',
      entityId: updated.id,
      payload: { jobId: updated.id, customerId: updated.customerId },
    });

    return updated;
  });
}

export interface CancelJobParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  reason: string;
}

/** Any non-terminal status -> `cancelled` — jobs.md business rule 5: "Job cancellation requires a reason code." Dispatcher/Admin/Owner only (not Technician-scoped — matches jobs-prd.md §12's plain `jobs:write` set). */
export async function cancelJob(db: DatabaseClient, params: CancelJobParams): Promise<Job> {
  return withRequestContext(db, params.actorUserId, (tx) =>
    transitionJobStatusInTx(tx, { ...params, toStatus: 'cancelled' }),
  );
}
