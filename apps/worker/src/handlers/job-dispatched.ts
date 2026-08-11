import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { findJobById } from '@atlas/jobs';
import { findScheduleEventByJobId, listScheduleEventAssignments } from '@atlas/scheduling';
import { findUserById } from '@atlas/identity';
import { findPrimaryContact } from '@atlas/crm';
import type { NotificationEvent } from '@atlas/notifications';
import { logger } from '../logger';
import { notifyBothChannels } from './notify-helpers';

export interface JobDispatchedEventData {
  organizationId: string;
  jobId: string;
  customerId: string;
}

/**
 * `job.dispatched` consumer — event-driven-architecture.md's catalog:
 * "SMS/email to Technician and Customer." First real consumer of this
 * event (previously unemitted — see `@atlas/scheduling`'s
 * `dispatchJob`). Notifies every Technician assigned to the Job's
 * schedule event, plus the Customer's primary Contact (if any) — a
 * Customer with no Contact on file is a documented, expected skip
 * (`findPrimaryContact` returning nothing is not an error).
 */
export async function handleJobDispatchedNotifications(
  db: DatabaseClient,
  data: JobDispatchedEventData,
): Promise<void> {
  const { job, scheduleEvent, assignments, primaryContact } = await withServiceContext(db, async (tx) => {
    const job = await findJobById(tx, data.jobId);
    const scheduleEvent = job ? await findScheduleEventByJobId(tx, data.jobId) : undefined;
    const assignments = scheduleEvent ? await listScheduleEventAssignments(tx, scheduleEvent.id) : [];
    const primaryContact = await findPrimaryContact(tx, data.customerId);
    return { job, scheduleEvent, assignments, primaryContact };
  });

  if (!job || !scheduleEvent) {
    logger.warn('job.dispatched: Job or schedule event not found, skipping notifications', {
      jobId: data.jobId,
    });
    return;
  }

  const technicianNames = await withServiceContext(db, async (tx) => {
    const users = await Promise.all(assignments.map((a) => findUserById(tx, a.userId)));
    return users.filter((u): u is NonNullable<typeof u> => Boolean(u)).map((u) => u.fullName);
  });

  const event: NotificationEvent = {
    type: 'job.dispatched',
    jobNumber: String(job.jobNumber),
    technicianName: technicianNames[0] ?? 'Your technician',
    scheduledStart: scheduleEvent.scheduledStart,
  };

  for (const assignment of assignments) {
    await notifyBothChannels(db, {
      organizationId: data.organizationId,
      event,
      recipient: { type: 'user', userId: assignment.userId },
    });
  }

  if (primaryContact) {
    await notifyBothChannels(db, {
      organizationId: data.organizationId,
      event,
      recipient: { type: 'contact', contactId: primaryContact.id },
    });
  }
}
