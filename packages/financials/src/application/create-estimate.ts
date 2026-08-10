import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findCustomerForOrganization, findContactForOrganization } from '@atlas/crm';
import { findJobById } from '@atlas/jobs';
import { computeLineTotal, computeSubtotal, computeTotal } from '../domain/money';
import { NotFoundError } from '../domain/errors';
import { insertEstimate, type Estimate } from '../infrastructure/estimates';
import {
  insertEstimateLineItems,
  type EstimateLineItem,
} from '../infrastructure/estimate-line-items';
import { allocateEstimateNumber } from '../infrastructure/numbering';
import { requireFinancialsPermission } from './authorize';

export interface CreateEstimateLineItemParams {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateEstimateParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  contactId?: string | undefined;
  validUntil?: Date | undefined;
  taxTotal?: number | undefined;
  lineItems: CreateEstimateLineItemParams[];
}

export interface CreateEstimateResult {
  estimate: Estimate;
  lineItems: EstimateLineItem[];
}

/**
 * estimates.md: an Estimate belongs to one Job; `customerId` is
 * denormalized from that Job (never accepted as direct client input,
 * matching @atlas/jobs's own Customer/Property denormalization
 * pattern). Every referenced Job/Contact is verified to belong to the
 * same Organization before the insert — defense-in-depth alongside the
 * database's own RLS `WITH CHECK`.
 */
export async function createEstimate(
  db: DatabaseClient,
  params: CreateEstimateParams,
): Promise<CreateEstimateResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'estimates',
      action: 'write',
    });

    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }

    const customer = await findCustomerForOrganization(tx, {
      organizationId: params.organizationId,
      customerId: job.customerId,
    });
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    if (params.contactId) {
      const contact = await findContactForOrganization(tx, {
        organizationId: params.organizationId,
        contactId: params.contactId,
      });
      if (!contact) {
        throw new NotFoundError('Contact');
      }
    }

    const computedLineItems = params.lineItems.map((item) => ({
      ...item,
      lineTotal: computeLineTotal(item.quantity, item.unitPrice),
    }));
    const subtotal = computeSubtotal(computedLineItems.map((item) => item.lineTotal));
    const taxTotal = params.taxTotal ?? 0;
    const total = computeTotal(subtotal, taxTotal);

    const estimateNumber = await allocateEstimateNumber(tx, params.organizationId);

    const estimate = await insertEstimate(tx, {
      organizationId: params.organizationId,
      estimateNumber,
      jobId: params.jobId,
      customerId: job.customerId,
      contactId: params.contactId,
      validUntil: params.validUntil,
      subtotal,
      taxTotal,
      total,
    });

    const lineItems = await insertEstimateLineItems(
      tx,
      params.organizationId,
      estimate.id,
      computedLineItems,
    );

    return { estimate, lineItems };
  });
}
