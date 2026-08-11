import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { findInvoiceById, findPaymentById } from '@atlas/financials';
import { findPrimaryContact } from '@atlas/crm';
import { syncPaymentToQuickBooks } from '@atlas/quickbooks';
import type { NotificationEvent } from '@atlas/notifications';
import { logger } from '../logger';
import { notifyBothChannels } from './notify-helpers';

export interface PaymentReceivedEventData {
  organizationId: string;
  paymentId: string;
  invoiceId: string;
}

/**
 * `payment.received` — two independent consumers per
 * event-driven-architecture.md's catalog: Notifications ("Send receipt")
 * and QuickBooks sync (integrations-prd.md §8). The event payload
 * (`capture-payment.ts`) carries no `customerId` — resolved here via the
 * Invoice, since Payments don't denormalize it (unlike Invoices/
 * Estimates, which do — see `financials.ts` schema comments).
 */
export async function handlePaymentReceived(db: DatabaseClient, data: PaymentReceivedEventData): Promise<void> {
  const { payment, invoice, primaryContact } = await withServiceContext(db, async (tx) => {
    const payment = await findPaymentById(tx, data.paymentId);
    const invoice = await findInvoiceById(tx, data.invoiceId);
    const primaryContact = invoice ? await findPrimaryContact(tx, invoice.customerId) : undefined;
    return { payment, invoice, primaryContact };
  });

  if (!payment || !invoice) {
    logger.warn('payment.received: Payment or Invoice not found, skipping', {
      paymentId: data.paymentId,
      invoiceId: data.invoiceId,
    });
    return;
  }

  if (primaryContact) {
    const event: NotificationEvent = {
      type: 'payment.received',
      amount: `$${payment.amount}`,
      invoiceNumber: String(invoice.invoiceNumber),
    };
    await notifyBothChannels(db, {
      organizationId: data.organizationId,
      event,
      recipient: { type: 'contact', contactId: primaryContact.id },
    });
  }

  await syncPaymentToQuickBooks(db, {
    organizationId: data.organizationId,
    paymentId: payment.id,
    invoiceId: invoice.id,
    totalAmt: Number(payment.amount),
  });
}
