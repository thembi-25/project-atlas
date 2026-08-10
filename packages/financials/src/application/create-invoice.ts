import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findJobById } from '@atlas/jobs';
import { computeLineTotal, computeSubtotal, computeTotal } from '../domain/money';
import { NotFoundError } from '../domain/errors';
import { insertInvoice, type Invoice } from '../infrastructure/invoices';
import { insertInvoiceLineItems, type InvoiceLineItem } from '../infrastructure/invoice-line-items';
import { requireFinancialsPermission } from './authorize';

export interface CreateInvoiceLineItemParams {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceParams {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  isDeposit?: boolean | undefined;
  dueDate?: Date | undefined;
  taxTotal?: number | undefined;
  lineItems: CreateInvoiceLineItemParams[];
}

export interface CreateInvoiceResult {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
}

/**
 * invoices.md: "sometimes directly from ad hoc line items for simple
 * jobs" — the non-Estimate-derived creation path. `estimateId` stays
 * null; see `estimate-transitions.ts`'s `generateInvoiceFromEstimateInTx`
 * for the Estimate-derived path.
 */
export async function createInvoice(
  db: DatabaseClient,
  params: CreateInvoiceParams,
): Promise<CreateInvoiceResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'invoices',
      action: 'write',
    });

    const job = await findJobById(tx, params.jobId);
    if (!job || job.organizationId !== params.organizationId) {
      throw new NotFoundError('Job');
    }

    const computedLineItems = params.lineItems.map((item) => ({
      ...item,
      lineTotal: computeLineTotal(item.quantity, item.unitPrice),
    }));
    const subtotal = computeSubtotal(computedLineItems.map((item) => item.lineTotal));
    const taxTotal = params.taxTotal ?? 0;
    const total = computeTotal(subtotal, taxTotal);

    const invoice = await insertInvoice(tx, {
      organizationId: params.organizationId,
      jobId: params.jobId,
      customerId: job.customerId,
      isDeposit: params.isDeposit,
      subtotal,
      taxTotal,
      total,
      dueDate: params.dueDate,
    });

    const lineItems = await insertInvoiceLineItems(
      tx,
      params.organizationId,
      invoice.id,
      computedLineItems,
    );

    return { invoice, lineItems };
  });
}
