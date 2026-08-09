import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { hasPermission } from '@atlas/identity';
import { findJobById, isUserAssignedToJob } from '@atlas/jobs';
import { ForbiddenError, NotFoundError } from '../domain/errors';
import {
  findCurrentDispatchEventForJob,
  setDispatchTimestamp,
  type DispatchEvent,
  type DispatchTimestampField,
} from '../infrastructure/dispatch-events';

export interface RecordDispatchTimestampParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}

/**
 * dispatch.md business rules 3-4: acknowledge/en-route/arrived are
 * Technician-initiated, timestamped events, scoped to "their own
 * assigned Jobs only" (dispatch-prd.md §12) — via `jobs:write_assigned`
 * (a Dispatcher/Admin/Owner with `jobs:write` may also record these on
 * a Technician's behalf, matching the same "write OR write_assigned"
 * pattern used throughout the Job lifecycle).
 */
async function recordDispatchTimestamp(
  db: DatabaseClient,
  params: RecordDispatchTimestampParams,
  field: DispatchTimestampField,
): Promise<DispatchEvent> {
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
        if (!hasWriteAssigned) throw new ForbiddenError();
        throw new NotFoundError('Job');
      }
    }

    const dispatchEvent = await findCurrentDispatchEventForJob(tx, params.jobId);
    if (!dispatchEvent) {
      throw new NotFoundError('Dispatch Event');
    }
    const updated = await setDispatchTimestamp(tx, dispatchEvent.id, field);
    if (!updated) {
      throw new NotFoundError('Dispatch Event');
    }
    return updated;
  });
}

export function acknowledgeDispatch(
  db: DatabaseClient,
  params: RecordDispatchTimestampParams,
): Promise<DispatchEvent> {
  return recordDispatchTimestamp(db, params, 'acknowledgedAt');
}

export function markEnRoute(
  db: DatabaseClient,
  params: RecordDispatchTimestampParams,
): Promise<DispatchEvent> {
  return recordDispatchTimestamp(db, params, 'enRouteAt');
}

export function markArrived(
  db: DatabaseClient,
  params: RecordDispatchTimestampParams,
): Promise<DispatchEvent> {
  return recordDispatchTimestamp(db, params, 'arrivedAt');
}
