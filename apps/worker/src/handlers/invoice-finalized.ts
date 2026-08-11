import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { findInvoiceById, listInvoiceLineItems } from '@atlas/financials';
import { findPrimaryContact } from '@atlas/crm';
import { syncInvoiceToQuickBooks } from '@atlas/quickbooks';
import type { NotificationEvent } from '@atlas/notifications';
import { logger } from '../logger';
import { notifyBothChannels } from './notify-helpers';

export interface InvoiceFinalizedEventData {
  organizationId: string;
  invoiceId: string;
  jobId: string;
  customerId: string;
}

/**
 * `invoice.finalized` — two independent consumers per
 * event-driven-architecture.md's catalog: Notifications ("Send Invoice to
 * Customer") and QuickBooks sync (integrations-prd.md §8, "Sync is
 * triggered by the same invoice.finalized ... event"). Both run from this
 * one handler (pg-boss's one-handler-per-queue limit — see
 * `job-completed-notify.ts`); a QuickBooks sync failure never blocks the
 * notification, and vice versa — each is independently try/caught by its
 * own callee (`syncInvoiceToQuickBooks` never throws; see its docstring).
 */
export async function handleInvoiceFinalized(db: DatabaseClient, data: InvoiceFinalizedEventData): Promise<void> {
  const { invoice, lineItems, primaryContact } = await withServiceContext(db, async (tx) => {
    const invoice = await findInvoiceById(tx, data.invoiceId);
    const lineItems = invoice ? await listInvoiceLineItems(tx, invoice.id) : [];
    const primaryContact = await findPrimaryContact(tx, data.customerId);
    return { invoice, lineItems, primaryContact };
  });

  if (!invoice) {
    logger.warn('invoice.finalized: Invoice not found, skipping', { invoiceId: data.invoiceId });
    return;
  }

  if (primaryContact) {
    const event: NotificationEvent = {
      type: 'invoice.finalized',
      invoiceNumber: String(invoice.invoiceNumber),
      total: `$${invoice.total}`,
      dueDate: invoice.dueDate,
    };
    await notifyBothChannels(db, {
      organizationId: data.organizationId,
      event,
      recipient: { type: 'contact', contactId: primaryContact.id },
    });
  }

  await syncInvoiceToQuickBooks(db, {
    organizationId: data.organizationId,
    invoiceId: invoice.id,
    invoiceNumber: String(invoice.invoiceNumber),
    lineItems: lineItems.map((item) => ({ description: item.description, amount: Number(item.lineTotal) })),
  });
}
