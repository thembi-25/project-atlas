import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { findEstimateById } from '@atlas/financials';
import { findJobById } from '@atlas/jobs';
import { findScheduleEventByJobId, listScheduleEventAssignments } from '@atlas/scheduling';
import type { NotificationEvent } from '@atlas/notifications';
import { logger } from '../logger';
import { notifyBothChannels } from './notify-helpers';

export interface EstimateApprovedEventData {
  organizationId: string;
  estimateId: string;
  jobId: string;
  customerId: string;
}

/**
 * `estimate.approved` consumer — event-driven-architecture.md's catalog:
 * "notify staff." The PRD text doesn't name a specific staff audience;
 * interpreted as the Job's already-assigned Technician(s) — the same
 * table row's "unblock Job execution if gated on approval" frames this as
 * field-crew-relevant, making the assigned Technician(s) the most
 * directly actionable recipient. A Job with no Technician assigned yet is
 * a documented, expected skip (see
 * docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md, this interpretation is
 * disclosed there too).
 */
export async function handleEstimateApprovedNotifications(
  db: DatabaseClient,
  data: EstimateApprovedEventData,
): Promise<void> {
  const { estimate, job, assignments } = await withServiceContext(db, async (tx) => {
    const estimate = await findEstimateById(tx, data.estimateId);
    const job = await findJobById(tx, data.jobId);
    const scheduleEvent = await findScheduleEventByJobId(tx, data.jobId);
    const assignments = scheduleEvent ? await listScheduleEventAssignments(tx, scheduleEvent.id) : [];
    return { estimate, job, assignments };
  });

  if (!estimate || !job) {
    logger.warn('estimate.approved: Estimate or Job not found, skipping notifications', {
      estimateId: data.estimateId,
      jobId: data.jobId,
    });
    return;
  }
  if (assignments.length === 0) return;

  const event: NotificationEvent = {
    type: 'estimate.approved',
    estimateNumber: String(estimate.estimateNumber),
    jobNumber: String(job.jobNumber),
  };

  for (const assignment of assignments) {
    await notifyBothChannels(db, {
      organizationId: data.organizationId,
      event,
      recipient: { type: 'user', userId: assignment.userId },
    });
  }
}
