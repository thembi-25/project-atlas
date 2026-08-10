import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { findContactByPortalUserAndCustomer } from '@atlas/crm';
import { createPaymentIntent } from '@atlas/integrations';
import { computeAmountPaid, computeBalanceDue, dollarsToCents } from '../domain/money';
import { NotFoundError, PaymentExceedsInvoiceBalanceError } from '../domain/errors';
import { findInvoiceById } from '../infrastructure/invoices';
import {
  findPaymentByIdempotencyKey,
  insertPayment,
  listNonFailedPaymentsForInvoice,
  type Payment,
} from '../infrastructure/payments';

export interface PortalCapturePaymentParams {
  portalUserId: string;
  invoiceId: string;
  amount: number;
  idempotencyKey: string;
}

export interface PortalCapturePaymentResult {
  payment: Payment;
  stripeClientSecret: string | null;
}

/**
 * The Customer Portal's Invoice-payment view — card only (no cash/check
 * from a self-serve session). Same service-context pre-verification
 * pattern as `portal-estimate-actions.ts`; the resulting Payment is
 * `pending` until the Stripe webhook confirms it, exactly like the staff
 * card-capture path in `capture-payment.ts`.
 */
export async function capturePaymentAsPortalContact(
  db: DatabaseClient,
  params: PortalCapturePaymentParams,
): Promise<PortalCapturePaymentResult> {
  return withServiceContext(db, async (tx) => {
    const existing = await findPaymentByIdempotencyKey(tx, params.idempotencyKey);
    if (existing) {
      return { payment: existing, stripeClientSecret: null };
    }

    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');

    const contact = await findContactByPortalUserAndCustomer(tx, {
      portalUserId: params.portalUserId,
      customerId: invoice.customerId,
    });
    if (!contact) throw new NotFoundError('Invoice');

    const existingPayments = await listNonFailedPaymentsForInvoice(tx, invoice.id);
    const amountPaid = computeAmountPaid(existingPayments.map((p) => Number(p.amount)));
    const balanceDue = computeBalanceDue(Number(invoice.total), amountPaid);
    if (params.amount > balanceDue) {
      throw new PaymentExceedsInvoiceBalanceError();
    }

    const intent = await createPaymentIntent({
      amountCents: dollarsToCents(params.amount),
      currency: 'usd',
      invoiceId: invoice.id,
      organizationId: invoice.organizationId,
      idempotencyKey: params.idempotencyKey,
    });

    const payment = await insertPayment(tx, {
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      amount: params.amount,
      method: 'card',
      status: 'pending',
      processor: 'stripe',
      processorReferenceId: intent.id,
      initiatedBy: 'customer_portal',
      idempotencyKey: params.idempotencyKey,
    });

    return { payment, stripeClientSecret: intent.clientSecret };
  });
}
