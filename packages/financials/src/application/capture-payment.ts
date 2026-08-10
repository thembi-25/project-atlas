import { recordDomainEvent, withRequestContext, type DatabaseClient } from '@atlas/database';
import { createPaymentIntent } from '@atlas/integrations';
import { computeAmountPaid, computeBalanceDue, dollarsToCents } from '../domain/money';
import { NotFoundError, PaymentExceedsInvoiceBalanceError } from '../domain/errors';
import { findInvoiceById } from '../infrastructure/invoices';
import {
  findPaymentByIdempotencyKey,
  insertPayment,
  listNonFailedPaymentsForInvoice,
  type Payment,
  type PaymentMethod,
} from '../infrastructure/payments';
import { requireFinancialsPermission } from './authorize';
import { recomputeInvoiceStatusAfterPayment } from './invoice-transitions';

export interface CapturePaymentParams {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  idempotencyKey: string;
}

export interface CapturePaymentResult {
  payment: Payment;
  /** Only present for `method: 'card'` — the client uses this to confirm the PaymentIntent via Stripe's client-side SDK. */
  stripeClientSecret?: string | null;
}

/**
 * payments.md: cash/check are recorded `completed` immediately (staff
 * directly observed the funds change hands); card payments are recorded
 * `pending` with a Stripe PaymentIntent, and only the webhook (never this
 * synchronous response) transitions them to `completed` — see ADR-018 and
 * `apps/worker`'s Stripe webhook handler (task #76).
 *
 * Idempotency (business rule/ADR-018): if a Payment already exists for
 * this `idempotencyKey`, it is returned as-is rather than creating a
 * second row or re-charging — the standard idempotent-capture pattern.
 */
export async function capturePayment(
  db: DatabaseClient,
  params: CapturePaymentParams,
): Promise<CapturePaymentResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'payments',
      action: 'capture',
    });

    const existing = await findPaymentByIdempotencyKey(tx, params.idempotencyKey);
    if (existing) {
      return { payment: existing };
    }

    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice || invoice.organizationId !== params.organizationId) {
      throw new NotFoundError('Invoice');
    }

    const existingPayments = await listNonFailedPaymentsForInvoice(tx, invoice.id);
    const amountPaid = computeAmountPaid(existingPayments.map((p) => Number(p.amount)));
    const balanceDue = computeBalanceDue(Number(invoice.total), amountPaid);
    if (params.amount > balanceDue) {
      throw new PaymentExceedsInvoiceBalanceError();
    }

    if (params.method === 'cash' || params.method === 'check') {
      const payment = await insertPayment(tx, {
        organizationId: params.organizationId,
        invoiceId: invoice.id,
        amount: params.amount,
        method: params.method,
        status: 'completed',
        initiatedBy: 'staff',
        capturedByUserId: params.actorUserId,
        idempotencyKey: params.idempotencyKey,
        completedAt: new Date(),
      });
      await recordPaymentReceivedEvent(tx, params.organizationId, invoice.id, payment.id);
      await recomputeInvoiceStatusAfterPayment(tx, invoice.id);
      return { payment };
    }

    const intent = await createPaymentIntent({
      amountCents: dollarsToCents(params.amount),
      currency: 'usd',
      invoiceId: invoice.id,
      organizationId: params.organizationId,
      idempotencyKey: params.idempotencyKey,
    });

    const payment = await insertPayment(tx, {
      organizationId: params.organizationId,
      invoiceId: invoice.id,
      amount: params.amount,
      method: params.method,
      status: 'pending',
      processor: 'stripe',
      processorReferenceId: intent.id,
      initiatedBy: 'staff',
      capturedByUserId: params.actorUserId,
      idempotencyKey: params.idempotencyKey,
    });

    return { payment, stripeClientSecret: intent.clientSecret };
  });
}

/** Shared by both the staff and Portal capture paths — see `portal-capture-payment.ts`. */
export async function recordPaymentReceivedEvent(
  tx: DatabaseClient,
  organizationId: string,
  invoiceId: string,
  paymentId: string,
): Promise<void> {
  await recordDomainEvent(tx, {
    organizationId,
    eventType: 'payment.received',
    entityType: 'financials.payments',
    entityId: paymentId,
    payload: { paymentId, invoiceId },
  });
}
