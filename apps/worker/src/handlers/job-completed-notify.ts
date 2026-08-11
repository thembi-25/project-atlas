import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { findJobById } from '@atlas/jobs';
import { findPrimaryContact } from '@atlas/crm';
import type { NotificationEvent } from '@atlas/notifications';
import { logger } from '../logger';
import { notifyBothChannels } from './notify-helpers';

export interface JobCompletedNotifyEventData {
  organizationId: string;
  jobId: string;
  customerId: string;
}

/**
 * `job.completed` Notifications consumer — event-driven-architecture.md's
 * catalog: "notify Customer." This is one of two `job.completed`
 * consumers (the other, pre-existing since Sprint 5, is Financials'
 * auto-invoice generation in `job-completed.ts`) — pg-boss allows only
 * one `boss.work` handler per queue, so `index.ts` calls both this
 * function and `handleJobCompleted` in sequence from a single
 * registration rather than registering the queue twice. Independent
 * failure isolation between the two is handled by `index.ts`, not here.
 */
export async function handleJobCompletedNotifications(
  db: DatabaseClient,
  data: JobCompletedNotifyEventData,
): Promise<void> {
  const { job, primaryContact } = await withServiceContext(db, async (tx) => {
    const job = await findJobById(tx, data.jobId);
    const primaryContact = await findPrimaryContact(tx, data.customerId);
    return { job, primaryContact };
  });

  if (!job) {
    logger.warn('job.completed: Job not found, skipping notifications', { jobId: data.jobId });
    return;
  }
  if (!primaryContact) {
    return;
  }

  const event: NotificationEvent = { type: 'job.completed', jobNumber: String(job.jobNumber) };

  await notifyBothChannels(db, {
    organizationId: data.organizationId,
    event,
    recipient: { type: 'contact', contactId: primaryContact.id },
  });
}
