import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { hasPermission } from '@atlas/identity';
import { JobIsImmutableError, NotFoundError } from '../domain/errors';
import { isTerminalJobStatus } from '../domain/lifecycle';
import { findJobById } from '../infrastructure/jobs';
import { isUserAssignedToJob } from '../infrastructure/job-assignments';
import {
  completeTask as completeTaskInfra,
  findTaskById,
  insertTask,
  listTasksForJob,
  reopenTask as reopenTaskInfra,
  type Task,
  type TaskType,
} from '../infrastructure/tasks';

async function requireJobWriteAccess(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string; jobId: string },
): Promise<void> {
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
  if (hasWrite) return;
  const hasWriteAssigned = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'jobs',
    action: 'write_assigned',
  });
  const assigned = hasWriteAssigned && (await isUserAssignedToJob(tx, job.id, params.actorUserId));
  if (!assigned) {
    throw new NotFoundError('Job');
  }
}

export interface ListTasksParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

export async function listTasks(db: DatabaseClient, params: ListTasksParams): Promise<Task[]> {
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
    return listTasksForJob(tx, params.jobId);
  });
}

export interface AddAdHocTaskParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  label: string;
  type: TaskType;
  isRequired?: boolean | undefined;
}

/** jobs.md business rule 2: "staff can add ad hoc Tasks" — no `checklistTemplateItemId` origin. */
export async function addAdHocTask(db: DatabaseClient, params: AddAdHocTaskParams): Promise<Task> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobWriteAccess(tx, params);
    const job = await findJobById(tx, params.jobId);
    if (!job) throw new NotFoundError('Job');
    if (isTerminalJobStatus(job.status)) {
      throw new JobIsImmutableError();
    }
    return insertTask(tx, {
      organizationId: params.organizationId,
      jobId: params.jobId,
      label: params.label,
      type: params.type,
      isRequired: params.isRequired,
    });
  });
}

export interface CompleteTaskParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  taskId: string;
  responseValue?: unknown;
  overrideReason?: string | undefined;
}

/** tasks.md business rule 4: completion is individually attributable even with multiple Technicians on the same Job. */
export async function completeTask(db: DatabaseClient, params: CompleteTaskParams): Promise<Task> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobWriteAccess(tx, params);
    const task = await findTaskById(tx, params.taskId);
    if (!task || task.jobId !== params.jobId || task.organizationId !== params.organizationId) {
      throw new NotFoundError('Task');
    }
    const updated = await completeTaskInfra(tx, params.taskId, {
      responseValue: params.responseValue,
      completedByUserId: params.actorUserId,
      overrideReason: params.overrideReason,
    });
    if (!updated) throw new NotFoundError('Task');
    return updated;
  });
}

export interface ReopenTaskParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  taskId: string;
}

export async function reopenTask(db: DatabaseClient, params: ReopenTaskParams): Promise<Task> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireJobWriteAccess(tx, params);
    const task = await findTaskById(tx, params.taskId);
    if (!task || task.jobId !== params.jobId || task.organizationId !== params.organizationId) {
      throw new NotFoundError('Task');
    }
    const updated = await reopenTaskInfra(tx, params.taskId);
    if (!updated) throw new NotFoundError('Task');
    return updated;
  });
}
