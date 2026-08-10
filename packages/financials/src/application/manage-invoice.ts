import { withRequestContext, type DatabaseClient } from '@atlas/database';
import {
  computeLineTotal,
  computeSubtotal,
  computeTotal,
  computeAmountPaid,
  computeBalanceDue,
} from '../domain/money';
import { InvoiceIsImmutableError, NotFoundError } from '../domain/errors';
import { findInvoiceById, updateInvoiceTotals, type Invoice } from '../infrastructure/invoices';
import {
  listInvoiceLineItems,
  replaceInvoiceLineItems,
  type InvoiceLineItem,
} from '../infrastructure/invoice-line-items';
import {
  listNonFailedPaymentsForInvoice,
  listPaymentsForInvoice,
  type Payment,
} from '../infrastructure/payments';
import {
  listInvoicesForOrganization,
  type InvoiceCursor,
  type InvoiceSortField,
  type SortDirection,
} from '../infrastructure/invoices';
import type { InvoiceStatus } from '../domain/lifecycle';
import { requireFinancialsPermission } from './authorize';

export interface GetInvoiceParams {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
}

export interface GetInvoiceResult {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  amountPaid: number;
  balanceDue: number;
}

/** invoices.md: `amount_paid`/`balance_due` are always computed from linked non-refunded Payments — never stored. */
export async function getInvoice(
  db: DatabaseClient,
  params: GetInvoiceParams,
): Promise<GetInvoiceResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'invoices',
      action: 'read',
    });
    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice || invoice.organizationId !== params.organizationId) {
      throw new NotFoundError('Invoice');
    }
    const [lineItems, payments] = await Promise.all([
      listInvoiceLineItems(tx, invoice.id),
      listNonFailedPaymentsForInvoice(tx, invoice.id),
    ]);
    const amountPaid = computeAmountPaid(payments.map((p) => Number(p.amount)));
    const balanceDue = computeBalanceDue(Number(invoice.total), amountPaid);
    return { invoice, lineItems, amountPaid, balanceDue };
  });
}

export interface ListInvoicesParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: InvoiceCursor | undefined;
  sortField: InvoiceSortField;
  sortDirection: SortDirection;
  status?: InvoiceStatus | undefined;
  jobId?: string | undefined;
  customerId?: string | undefined;
}

export async function listInvoices(db: DatabaseClient, params: ListInvoicesParams) {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'invoices',
      action: 'read',
    });
    return listInvoicesForOrganization(tx, params);
  });
}

export interface UpdateInvoiceDraftLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number | undefined;
}

export interface UpdateInvoiceDraftParams {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
  lineItems: UpdateInvoiceDraftLineItemInput[];
  dueDate?: Date | null | undefined;
  taxTotal?: number | undefined;
}

/** invoices.md business rule 1: editable only while `draft` (immutable once `finalized`). */
export async function updateInvoiceDraft(
  db: DatabaseClient,
  params: UpdateInvoiceDraftParams,
): Promise<GetInvoiceResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'invoices',
      action: 'write',
    });
    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice || invoice.organizationId !== params.organizationId) {
      throw new NotFoundError('Invoice');
    }
    if (invoice.status !== 'draft') {
      throw new InvoiceIsImmutableError();
    }

    const computed = params.lineItems.map((item) => ({
      ...item,
      lineTotal: computeLineTotal(item.quantity, item.unitPrice),
    }));
    const subtotal = computeSubtotal(computed.map((item) => item.lineTotal));
    const taxTotal = params.taxTotal ?? Number(invoice.taxTotal);
    const total = computeTotal(subtotal, taxTotal);

    const lineItems = await replaceInvoiceLineItems(
      tx,
      params.organizationId,
      invoice.id,
      computed,
    );
    const updated = await updateInvoiceTotals(tx, invoice.id, { subtotal, taxTotal, total });
    if (!updated) throw new NotFoundError('Invoice');

    return { invoice: updated, lineItems, amountPaid: 0, balanceDue: total };
  });
}

export interface ListInvoicePaymentsParams {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
}

/** payments.md, "API requirements": "read endpoints scoped to Invoice/Job/Customer." */
export async function listInvoicePayments(
  db: DatabaseClient,
  params: ListInvoicePaymentsParams,
): Promise<Payment[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'payments',
      action: 'read',
    });
    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice || invoice.organizationId !== params.organizationId) {
      throw new NotFoundError('Invoice');
    }
    return listPaymentsForInvoice(tx, invoice.id);
  });
}
