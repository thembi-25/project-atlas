import { recordDomainEvent, withRequestContext, type DatabaseClient } from '@atlas/database';
import { findJobById } from '@atlas/jobs';
import { canTransitionInvoiceStatus } from '../domain/lifecycle';
import {
  InvalidInvoiceStateError,
  InvoiceHasPaymentsError,
  InvoiceNotFinalizableError,
  NotFoundError,
} from '../domain/errors';
import { findInvoiceById, setInvoiceStatus, type Invoice } from '../infrastructure/invoices';
import {
  listNonFailedPaymentsForInvoice,
  listPaymentsForInvoice,
} from '../infrastructure/payments';
import { allocateInvoiceNumber } from '../infrastructure/numbering';
import { insertCreditNote, type CreditNote } from '../infrastructure/credit-notes';
import { computeAmountPaid, computeBalanceDue } from '../domain/money';
import { requireFinancialsPermission } from './authorize';

/**
 * invoices.md#state-machine: `sent -> partially_paid -> paid`, driven by
 * recorded Payments. Called after any Payment reaches `completed` (both
 * the immediate cash/check path in `capture-payment.ts` and the
 * asynchronous Stripe webhook path in `stripe-webhook-handler.ts`).
 * Deliberately one-directional (never reverts `paid` back to
 * `partially_paid` after a refund) — the documented state diagram shows
 * no reverse edge, so auto-reverting would be undocumented, invented
 * behavior; a refund's effect on collections is visible via the Payment
 * record itself, not a forced Invoice status change.
 */
export async function recomputeInvoiceStatusAfterPayment(
  tx: DatabaseClient,
  invoiceId: string,
): Promise<void> {
  const invoice = await findInvoiceById(tx, invoiceId);
  if (!invoice || (invoice.status !== 'sent' && invoice.status !== 'partially_paid')) return;

  const payments = await listNonFailedPaymentsForInvoice(tx, invoiceId);
  const amountPaid = computeAmountPaid(payments.map((p) => Number(p.amount)));
  const balanceDue = computeBalanceDue(Number(invoice.total), amountPaid);

  if (balanceDue <= 0) {
    await setInvoiceStatus(tx, invoiceId, { status: 'paid' });
  } else if (amountPaid > 0 && invoice.status === 'sent') {
    await setInvoiceStatus(tx, invoiceId, { status: 'partially_paid' });
  }
}

export interface FinalizeInvoiceParams {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
}

/**
 * `draft` -> `finalized` — invoices.md business rule 3: the parent Job
 * must be `completed`, except deposit/progress Invoices
 * (`isDeposit = true`), which may finalize earlier. Allocates the
 * gap-free `invoice_number` here, per
 * `packages/database/src/schema/financials.ts`'s comment on
 * `invoiceNumberCounters`. Once finalized, the Invoice is immutable
 * (enforced by `updateInvoiceDraft`'s draft-only check — see
 * `manage-invoice.ts`).
 */
export async function finalizeInvoice(
  db: DatabaseClient,
  params: FinalizeInvoiceParams,
): Promise<Invoice> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'invoices',
      action: 'finalize',
    });
    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice || invoice.organizationId !== params.organizationId) {
      throw new NotFoundError('Invoice');
    }
    if (!canTransitionInvoiceStatus(invoice.status, 'finalized')) {
      throw new InvalidInvoiceStateError(
        `Cannot finalize an Invoice in status "${invoice.status}".`,
      );
    }
    if (!invoice.isDeposit) {
      const job = await findJobById(tx, invoice.jobId);
      if (!job || job.status !== 'completed') {
        throw new InvoiceNotFinalizableError();
      }
    }

    const invoiceNumber = await allocateInvoiceNumber(tx, params.organizationId);
    const updated = await setInvoiceStatus(tx, invoice.id, {
      status: 'finalized',
      invoiceNumber,
      finalizedAt: new Date(),
    });
    if (!updated) throw new NotFoundError('Invoice');

    await recordDomainEvent(tx, {
      organizationId: params.organizationId,
      eventType: 'invoice.finalized',
      entityType: 'financials.invoices',
      entityId: updated.id,
      payload: { invoiceId: updated.id, jobId: updated.jobId, customerId: updated.customerId },
    });

    return updated;
  });
}

export interface SendInvoiceParams {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
}

/** `finalized` -> `sent`. */
export async function sendInvoice(db: DatabaseClient, params: SendInvoiceParams): Promise<Invoice> {
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
    if (!canTransitionInvoiceStatus(invoice.status, 'sent')) {
      throw new InvalidInvoiceStateError(`Cannot send an Invoice in status "${invoice.status}".`);
    }
    const updated = await setInvoiceStatus(tx, invoice.id, { status: 'sent', sentAt: new Date() });
    if (!updated) throw new NotFoundError('Invoice');
    return updated;
  });
}

export interface VoidInvoiceParams {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
  reason: string;
}

/** `draft`/`finalized` -> `void` — invoices.md business rule 1: only permitted before any Payment has been applied. */
export async function voidInvoice(db: DatabaseClient, params: VoidInvoiceParams): Promise<Invoice> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'invoices',
      action: 'void',
    });
    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice || invoice.organizationId !== params.organizationId) {
      throw new NotFoundError('Invoice');
    }
    if (!canTransitionInvoiceStatus(invoice.status, 'void')) {
      throw new InvalidInvoiceStateError(`Cannot void an Invoice in status "${invoice.status}".`);
    }
    const payments = await listPaymentsForInvoice(tx, invoice.id);
    if (payments.some((p) => p.status !== 'failed')) {
      throw new InvoiceHasPaymentsError();
    }
    const updated = await setInvoiceStatus(tx, invoice.id, {
      status: 'void',
      voidedAt: new Date(),
      voidReason: params.reason,
    });
    if (!updated) throw new NotFoundError('Invoice');
    return updated;
  });
}

export interface IssueCreditNoteParams {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
  reason: string;
  amount: number;
}

/** invoices.md business rule 1: a Credit Note is the only way to correct a finalized Invoice's totals without mutating the row itself. Gated on `invoices:void` — see migration 0021's `credit_notes_insert` comment. */
export async function issueCreditNote(
  db: DatabaseClient,
  params: IssueCreditNoteParams,
): Promise<CreditNote> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireFinancialsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'invoices',
      action: 'void',
    });
    const invoice = await findInvoiceById(tx, params.invoiceId);
    if (!invoice || invoice.organizationId !== params.organizationId) {
      throw new NotFoundError('Invoice');
    }
    return insertCreditNote(tx, {
      organizationId: params.organizationId,
      invoiceId: invoice.id,
      reason: params.reason,
      amount: params.amount,
      issuedByUserId: params.actorUserId,
    });
  });
}
