import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { findApprovedEstimateForJob, generateInvoiceFromEstimateInTx } from '@atlas/financials';
import { logger } from '../logger';

export interface JobCompletedEventData {
  jobId: string;
}

/**
 * `job.completed` consumer — docs/13-roadmap/sprint-5.md's "Scope
 * decisions": auto-generates a draft Invoice ONLY when the completed Job
 * has an `approved` Estimate to mirror line items from (reconciling
 * invoicing-prd.md's "zero re-entry" goal with never blindly
 * auto-generating an Invoice with no real content). If no approved
 * Estimate exists, this is a deliberate no-op — staff creates the
 * Invoice manually via `createInvoice` (ad hoc line items) instead.
 * Idempotent under pg-boss's at-least-once delivery: after the first
 * successful run, the Estimate is `converted`, so
 * `findApprovedEstimateForJob` (which only matches `status = 'approved'`)
 * naturally returns nothing on a re-delivery — the "no approved Estimate"
 * no-op path handles retries without any extra bookkeeping.
 */
export async function handleJobCompleted(
  db: DatabaseClient,
  data: JobCompletedEventData,
): Promise<void> {
  await withServiceContext(db, async (tx) => {
    const estimate = await findApprovedEstimateForJob(tx, data.jobId);
    if (!estimate) {
      logger.info('job.completed: no approved Estimate, skipping auto-invoice', {
        jobId: data.jobId,
      });
      return;
    }

    const result = await generateInvoiceFromEstimateInTx(tx, {
      organizationId: estimate.organizationId,
      estimateId: estimate.id,
    });

    logger.info('job.completed: auto-generated draft Invoice from approved Estimate', {
      jobId: data.jobId,
      estimateId: estimate.id,
      invoiceId: result.invoice.id,
    });
  });
}
