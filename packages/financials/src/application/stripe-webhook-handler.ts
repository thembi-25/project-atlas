import type { DatabaseClient } from '@atlas/database';
import type { StripeWebhookEvent } from '@atlas/integrations';
import { findPaymentByProcessorReferenceId, setPaymentStatus } from '../infrastructure/payments';
import { recomputeInvoiceStatusAfterPayment } from './invoice-transitions';
import { recordPaymentReceivedEvent } from './capture-payment';

/**
 * Processes one already-verified, already-deduplicated Stripe event —
 * called by `apps/worker`'s webhook consumer (task #76) under
 * `withServiceContext`, never inline in the route handler, per
 * docs/05-api/webhooks.md's mandated pattern. This is the ONLY code path
 * that ever transitions a card Payment out of `pending` — ADR-018:
 * "reconciliation and refund processing rely on webhook-driven
 * asynchronous confirmation ... as the authoritative source of truth for
 * Payment completion, not the client's immediate response."
 *
 * Unrecognized event types are ignored (not every Stripe event this
 * account could emit is relevant to Atlas's Payment model) rather than
 * erroring, so an unexpected Stripe event never blocks Worker processing.
 */
export async function processStripeWebhookEvent(
  tx: DatabaseClient,
  event: StripeWebhookEvent,
): Promise<void> {
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as { id: string };
    const payment = await findPaymentByProcessorReferenceId(tx, intent.id);
    if (!payment || payment.status !== 'pending') return;

    const updated = await setPaymentStatus(tx, payment.id, {
      status: 'completed',
      completedAt: new Date(),
    });
    if (!updated) return;

    await recordPaymentReceivedEvent(tx, payment.organizationId, payment.invoiceId, payment.id);
    await recomputeInvoiceStatusAfterPayment(tx, payment.invoiceId);
    return;
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as { id: string };
    const payment = await findPaymentByProcessorReferenceId(tx, intent.id);
    if (!payment || payment.status !== 'pending') return;

    await setPaymentStatus(tx, payment.id, { status: 'failed', failedAt: new Date() });
    return;
  }
}
