import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { computeLineTotal, computeSubtotal, computeTotal } from '../domain/money';
import { EstimateLineItemsImmutableError, NotFoundError } from '../domain/errors';
import { findEstimateById, updateEstimateTotals, type Estimate } from '../infrastructure/estimates';
import {
  listEstimateLineItems,
  replaceEstimateLineItems,
  type EstimateLineItem,
} from '../infrastructure/estimate-line-items';
import {
  listEstimatesForOrganization,
  type EstimateCursor,
  type EstimateSortField,
  type SortDirection,
} from '../infrastructure/estimates';
import type { EstimateStatus } from '../domain/lifecycle';
import { requireFinancialsPermission } from './authorize';

export interface GetEstimateParams {
  organizationId: string;
  actorUserId: string;
  estimateId: string;
}

export interface GetEstimateResult {
  estimate: Estimate;
  lineItems: EstimateLineItem[];
}

export async function getEstimate(
  db: DatabaseClient,
  params: GetEstimateParams,
): Promise<GetEstimateResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'estimates',
      action: 'read',
    });
    const estimate = await findEstimateById(tx, params.estimateId);
    if (!estimate || estimate.organizationId !== params.organizationId) {
      throw new NotFoundError('Estimate');
    }
    const lineItems = await listEstimateLineItems(tx, estimate.id);
    return { estimate, lineItems };
  });
}

export interface ListEstimatesParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: EstimateCursor | undefined;
  sortField: EstimateSortField;
  sortDirection: SortDirection;
  status?: EstimateStatus | undefined;
  jobId?: string | undefined;
  customerId?: string | undefined;
}

export async function listEstimates(db: DatabaseClient, params: ListEstimatesParams) {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'estimates',
      action: 'read',
    });
    return listEstimatesForOrganization(tx, params);
  });
}

export interface UpdateEstimateDraftLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number | undefined;
}

export interface UpdateEstimateDraftParams {
  organizationId: string;
  actorUserId: string;
  estimateId: string;
  lineItems: UpdateEstimateDraftLineItemInput[];
  taxTotal?: number | undefined;
}

/** estimates.md business rule 2: line items are editable only while `draft` (never after `sent`). CRUD "update restricted to `draft`" — estimates.md API requirements. */
export async function updateEstimateDraft(
  db: DatabaseClient,
  params: UpdateEstimateDraftParams,
): Promise<GetEstimateResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'estimates',
      action: 'write',
    });
    const estimate = await findEstimateById(tx, params.estimateId);
    if (!estimate || estimate.organizationId !== params.organizationId) {
      throw new NotFoundError('Estimate');
    }
    if (estimate.status !== 'draft') {
      throw new EstimateLineItemsImmutableError();
    }

    const computed = params.lineItems.map((item) => ({
      ...item,
      lineTotal: computeLineTotal(item.quantity, item.unitPrice),
    }));
    const subtotal = computeSubtotal(computed.map((item) => item.lineTotal));
    const taxTotal = params.taxTotal ?? Number(estimate.taxTotal);
    const total = computeTotal(subtotal, taxTotal);

    const lineItems = await replaceEstimateLineItems(
      tx,
      params.organizationId,
      estimate.id,
      computed,
    );
    const updated = await updateEstimateTotals(tx, estimate.id, { subtotal, taxTotal, total });
    if (!updated) throw new NotFoundError('Estimate');

    return { estimate: updated, lineItems };
  });
}
