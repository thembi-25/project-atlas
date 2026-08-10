import { recordDomainEvent, withRequestContext, type DatabaseClient } from '@atlas/database';
import { canTransitionEstimateStatus } from '../domain/lifecycle';
import { EstimateExpiredError, InvalidEstimateStateError, NotFoundError } from '../domain/errors';
import { findEstimateById, setEstimateStatus, type Estimate } from '../infrastructure/estimates';
import { listEstimateLineItems } from '../infrastructure/estimate-line-items';
import { insertInvoiceLineItems } from '../infrastructure/invoice-line-items';
import { insertInvoice, type Invoice } from '../infrastructure/invoices';
import { requireFinancialsPermission } from './authorize';

export interface SendEstimateParams {
  organizationId: string;
  actorUserId: string;
  estimateId: string;
}

/** `draft` -> `sent` — estimates.md#state-machine. */
export async function sendEstimate(
  db: DatabaseClient,
  params: SendEstimateParams,
): Promise<Estimate> {
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
    if (!canTransitionEstimateStatus(estimate.status, 'sent')) {
      throw new InvalidEstimateStateError(
        `Cannot send an Estimate in status "${estimate.status}".`,
      );
    }
    const updated = await setEstimateStatus(tx, estimate.id, {
      status: 'sent',
      sentAt: new Date(),
    });
    if (!updated) throw new NotFoundError('Estimate');
    return updated;
  });
}

export interface ApproveEstimateStaffParams {
  organizationId: string;
  actorUserId: string;
  estimateId: string;
}

/** `sent` -> `approved`, staff capturing the Customer's decision in person (with a signature Document, out of this sprint's scope) — estimates.md Key attributes: `approved_by_user_id`. The Portal's own Contact-initiated approve path is `application/portal-estimate-actions.ts`. */
export async function approveEstimateAsStaff(
  db: DatabaseClient,
  params: ApproveEstimateStaffParams,
): Promise<Estimate> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'estimates',
      action: 'write',
    });
    return approveEstimateInTx(tx, {
      organizationId: params.organizationId,
      estimateId: params.estimateId,
      approvedByUserId: params.actorUserId,
    });
  });
}

export interface ApproveEstimateInTxParams {
  organizationId: string;
  estimateId: string;
  approvedByUserId?: string | undefined;
  approvedByContactId?: string | undefined;
}

/**
 * The tx-composable core shared by the staff path above and the Portal's
 * Contact path (`portal-estimate-actions.ts`, which runs under
 * `withServiceContext` with its own pre-verification instead of
 * `requireFinancialsPermission`). estimates.md business rule 4: an
 * expired Estimate cannot be approved.
 */
export async function approveEstimateInTx(
  tx: DatabaseClient,
  params: ApproveEstimateInTxParams,
): Promise<Estimate> {
  const estimate = await findEstimateById(tx, params.estimateId);
  if (!estimate || estimate.organizationId !== params.organizationId) {
    throw new NotFoundError('Estimate');
  }
  if (!canTransitionEstimateStatus(estimate.status, 'approved')) {
    throw new InvalidEstimateStateError(
      `Cannot approve an Estimate in status "${estimate.status}".`,
    );
  }
  if (estimate.validUntil && estimate.validUntil.getTime() < Date.now()) {
    throw new EstimateExpiredError();
  }
  const updated = await setEstimateStatus(tx, estimate.id, {
    status: 'approved',
    approvedAt: new Date(),
    approvedByUserId: params.approvedByUserId ?? null,
    approvedByContactId: params.approvedByContactId ?? null,
  });
  if (!updated) throw new NotFoundError('Estimate');

  await recordDomainEvent(tx, {
    organizationId: params.organizationId,
    eventType: 'estimate.approved',
    entityType: 'financials.estimates',
    entityId: updated.id,
    payload: { estimateId: updated.id, jobId: updated.jobId, customerId: updated.customerId },
  });

  return updated;
}

export interface RejectEstimateStaffParams {
  organizationId: string;
  actorUserId: string;
  estimateId: string;
  reason?: string | undefined;
}

export async function rejectEstimateAsStaff(
  db: DatabaseClient,
  params: RejectEstimateStaffParams,
): Promise<Estimate> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'estimates',
      action: 'write',
    });
    return rejectEstimateInTx(tx, params);
  });
}

export interface RejectEstimateInTxParams {
  organizationId: string;
  estimateId: string;
  reason?: string | undefined;
}

export async function rejectEstimateInTx(
  tx: DatabaseClient,
  params: RejectEstimateInTxParams,
): Promise<Estimate> {
  const estimate = await findEstimateById(tx, params.estimateId);
  if (!estimate || estimate.organizationId !== params.organizationId) {
    throw new NotFoundError('Estimate');
  }
  if (!canTransitionEstimateStatus(estimate.status, 'rejected')) {
    throw new InvalidEstimateStateError(
      `Cannot reject an Estimate in status "${estimate.status}".`,
    );
  }
  const updated = await setEstimateStatus(tx, estimate.id, {
    status: 'rejected',
    rejectedAt: new Date(),
    rejectionReason: params.reason ?? null,
  });
  if (!updated) throw new NotFoundError('Estimate');
  return updated;
}

export interface CancelEstimateParams {
  organizationId: string;
  actorUserId: string;
  estimateId: string;
  reason?: string | undefined;
}

/** `draft`/`sent` -> `cancelled` — gated on `estimates:void` (Accountant/Admin/Owner only), not `estimates:write` (see migration 0021's `credit_notes_insert` comment for the same elevated-tier reasoning). */
export async function cancelEstimate(
  db: DatabaseClient,
  params: CancelEstimateParams,
): Promise<Estimate> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'estimates',
      action: 'void',
    });
    const estimate = await findEstimateById(tx, params.estimateId);
    if (!estimate || estimate.organizationId !== params.organizationId) {
      throw new NotFoundError('Estimate');
    }
    if (!canTransitionEstimateStatus(estimate.status, 'cancelled')) {
      throw new InvalidEstimateStateError(
        `Cannot cancel an Estimate in status "${estimate.status}".`,
      );
    }
    const updated = await setEstimateStatus(tx, estimate.id, {
      status: 'cancelled',
      cancellationReason: params.reason ?? null,
    });
    if (!updated) throw new NotFoundError('Estimate');
    return updated;
  });
}

export interface ConvertEstimateParams {
  organizationId: string;
  actorUserId: string;
  estimateId: string;
  dueDate?: Date | undefined;
}

export interface ConvertEstimateResult {
  estimate: Estimate;
  invoice: Invoice;
}

/** Manual, staff-triggered `approved` -> `converted` — gated on `estimates:finalize`. The automatic path (Job completion, if an approved Estimate exists) calls `generateInvoiceFromEstimateInTx` directly from `apps/worker`'s `job.completed` handler instead — see docs/13-roadmap/sprint-5.md. */
export async function convertEstimateToInvoice(
  db: DatabaseClient,
  params: ConvertEstimateParams,
): Promise<ConvertEstimateResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'estimates',
      action: 'finalize',
    });
    return generateInvoiceFromEstimateInTx(tx, {
      organizationId: params.organizationId,
      estimateId: params.estimateId,
      dueDate: params.dueDate,
    });
  });
}

export interface GenerateInvoiceFromEstimateParams {
  organizationId: string;
  estimateId: string;
  dueDate?: Date | undefined;
}

/**
 * The tx-composable core: mirrors an approved Estimate's line items onto
 * a new **draft** Invoice (estimates.md: "Produces an Invoice when
 * approved and the work is completed") and marks the Estimate
 * `converted`. No permission check — callers are either an already-
 * permission-checked staff wrapper (above) or `apps/worker`'s trusted,
 * system-triggered `job.completed` consumer (service-context, no human
 * actor to check a Permission against).
 */
export async function generateInvoiceFromEstimateInTx(
  tx: DatabaseClient,
  params: GenerateInvoiceFromEstimateParams,
): Promise<ConvertEstimateResult> {
  const estimate = await findEstimateById(tx, params.estimateId);
  if (!estimate || estimate.organizationId !== params.organizationId) {
    throw new NotFoundError('Estimate');
  }
  if (!canTransitionEstimateStatus(estimate.status, 'converted')) {
    throw new InvalidEstimateStateError(
      `Cannot convert an Estimate in status "${estimate.status}" to an Invoice.`,
    );
  }

  const estimateLineItems = await listEstimateLineItems(tx, estimate.id);

  const invoice = await insertInvoice(tx, {
    organizationId: params.organizationId,
    jobId: estimate.jobId,
    estimateId: estimate.id,
    customerId: estimate.customerId,
    subtotal: Number(estimate.subtotal),
    taxTotal: Number(estimate.taxTotal),
    total: Number(estimate.total),
    dueDate: params.dueDate ?? null,
  });

  await insertInvoiceLineItems(
    tx,
    params.organizationId,
    invoice.id,
    estimateLineItems.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      sortOrder: item.sortOrder,
    })),
  );

  const updatedEstimate = await setEstimateStatus(tx, estimate.id, { status: 'converted' });
  if (!updatedEstimate) throw new NotFoundError('Estimate');

  return { estimate: updatedEstimate, invoice };
}
