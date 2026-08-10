import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { computeAmountPaid, computeBalanceDue } from '../domain/money';
import { NotFoundError } from '../domain/errors';
import { findEstimateById } from '../infrastructure/estimates';
import { listEstimateLineItems } from '../infrastructure/estimate-line-items';
import { findInvoiceById } from '../infrastructure/invoices';
import { listInvoiceLineItems } from '../infrastructure/invoice-line-items';
import {
  listNonFailedPaymentsForInvoice,
  listPaymentsForInvoice,
} from '../infrastructure/payments';

/**
 * Customer Portal read paths — no `requireFinancialsPermission` call:
 * a Contact holds no Membership/Permission at all, so that check would
 * always fail. Instead these rely entirely on the `_portal_select` RLS
 * policies added in migration 0021 (`contacts.portal_user_id =
 * (select auth.uid())`) to scope visibility — `withRequestContext` sets
 * the same session-level actor identity for a Contact's `portalUserId`
 * as it does for a staff `actorUserId`; RLS doesn't distinguish the two,
 * it only matches the UUID. A row simply not appearing/matching (rather
 * than an explicit permission check) is what produces the 404 below.
 */
export async function getEstimateForPortalContact(
  db: DatabaseClient,
  params: { portalUserId: string; estimateId: string },
) {
  return withRequestContext(db, params.portalUserId, async (tx) => {
    const estimate = await findEstimateById(tx, params.estimateId);
    if (!estimate) throw new NotFoundError('Estimate');
    const lineItems = await listEstimateLineItems(tx, estimate.id);
    return { estimate, lineItems };
  });
}

export async function getInvoiceForPortalContact(
  db: DatabaseClient,
  params: { portalUserId: string; invoiceId: string },
) {
  return withRequestContext(db, params.portalUserId, async (tx) => {
    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');
    const [lineItems, payments] = await Promise.all([
      listInvoiceLineItems(tx, invoice.id),
      listNonFailedPaymentsForInvoice(tx, invoice.id),
    ]);
    const amountPaid = computeAmountPaid(payments.map((p) => Number(p.amount)));
    const balanceDue = computeBalanceDue(Number(invoice.total), amountPaid);
    const receipts = await listPaymentsForInvoice(tx, invoice.id);
    return { invoice, lineItems, amountPaid, balanceDue, payments: receipts };
  });
}
