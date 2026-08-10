import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { createRefund } from '@atlas/integrations';
import { dollarsToCents } from '../domain/money';
import { InvalidPaymentStateError, NotFoundError } from '../domain/errors';
import {
  findPaymentById,
  insertPayment,
  setPaymentStatus,
  type Payment,
} from '../infrastructure/payments';
import { requireFinancialsPermission } from './authorize';

export interface RefundPaymentParams {
  organizationId: string;
  actorUserId: string;
  paymentId: string;
  amount: number;
  idempotencyKey: string;
}

export interface RefundPaymentResult {
  originalPayment: Payment;
  refundPayment: Payment;
}

/**
 * payments.md business rule 3: a refund is a NEW Payment record with a
 * negative amount and `refund_of_payment_id`, never a mutation/deletion
 * of the original — plus the original transitions `completed` ->
 * `refunded` (state machine). Gated on `payments:refund`
 * (Accountant/Admin/Owner only). Cash/check refunds skip the Stripe call
 * (no `processor_reference_id` to refund against — payments.md business
 * rule 5).
 */
export async function refundPayment(
  db: DatabaseClient,
  params: RefundPaymentParams,
): Promise<RefundPaymentResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'payments',
      action: 'refund',
    });

    const original = await findPaymentById(tx, params.paymentId);
    if (!original || original.organizationId !== params.organizationId) {
      throw new NotFoundError('Payment');
    }
    if (original.status !== 'completed') {
      throw new InvalidPaymentStateError(`Cannot refund a Payment in status "${original.status}".`);
    }

    if (original.processor === 'stripe' && original.processorReferenceId) {
      await createRefund({
        paymentIntentId: original.processorReferenceId,
        amountCents: dollarsToCents(params.amount),
        idempotencyKey: params.idempotencyKey,
      });
    }

    const refundPaymentRow = await insertPayment(tx, {
      organizationId: params.organizationId,
      invoiceId: original.invoiceId,
      amount: -Math.abs(params.amount),
      method: original.method,
      status: 'completed',
      processor: original.processor,
      processorReferenceId: original.processorReferenceId,
      initiatedBy: 'staff',
      capturedByUserId: params.actorUserId,
      refundOfPaymentId: original.id,
      idempotencyKey: params.idempotencyKey,
      completedAt: new Date(),
    });

    const updatedOriginal = await setPaymentStatus(tx, original.id, {
      status: 'refunded',
      refundedAt: new Date(),
    });
    if (!updatedOriginal) throw new NotFoundError('Payment');

    return { originalPayment: updatedOriginal, refundPayment: refundPaymentRow };
  });
}
