import { describe, expect, it } from 'vitest';
import {
  canTransitionEstimateStatus,
  canTransitionInvoiceStatus,
  canTransitionPaymentStatus,
  ESTIMATE_STATUSES,
  INVOICE_STATUSES,
  isInvoiceOverdue,
  isTerminalEstimateStatus,
  isTerminalInvoiceStatus,
  PAYMENT_STATUSES,
} from './lifecycle';

describe('canTransitionEstimateStatus', () => {
  const allowed: [string, string][] = [
    ['draft', 'sent'],
    ['draft', 'cancelled'],
    ['sent', 'approved'],
    ['sent', 'rejected'],
    ['sent', 'expired'],
    ['sent', 'cancelled'],
    ['approved', 'converted'],
  ];
  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransitionEstimateStatus(from as never, to as never)).toBe(true);
  });

  it('rejects transitions not in the documented diagram', () => {
    expect(canTransitionEstimateStatus('draft', 'approved')).toBe(false);
    expect(canTransitionEstimateStatus('rejected', 'sent')).toBe(false);
    expect(canTransitionEstimateStatus('converted', 'draft')).toBe(false);
  });

  it('every status is reachable in the enum and terminal statuses have no outgoing transitions', () => {
    for (const status of ESTIMATE_STATUSES) {
      if (isTerminalEstimateStatus(status)) {
        for (const target of ESTIMATE_STATUSES) {
          expect(canTransitionEstimateStatus(status, target)).toBe(false);
        }
      }
    }
  });
});

describe('canTransitionInvoiceStatus', () => {
  const allowed: [string, string][] = [
    ['draft', 'finalized'],
    ['draft', 'void'],
    ['finalized', 'sent'],
    ['finalized', 'void'],
    ['sent', 'partially_paid'],
    ['sent', 'paid'],
    ['partially_paid', 'paid'],
  ];
  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransitionInvoiceStatus(from as never, to as never)).toBe(true);
  });

  it('rejects transitions not in the documented diagram', () => {
    expect(canTransitionInvoiceStatus('paid', 'void')).toBe(false);
    expect(canTransitionInvoiceStatus('sent', 'void')).toBe(false);
    expect(canTransitionInvoiceStatus('draft', 'sent')).toBe(false);
  });

  it('terminal statuses have no outgoing transitions', () => {
    for (const status of INVOICE_STATUSES) {
      if (isTerminalInvoiceStatus(status)) {
        for (const target of INVOICE_STATUSES) {
          expect(canTransitionInvoiceStatus(status, target)).toBe(false);
        }
      }
    }
  });
});

describe('isInvoiceOverdue', () => {
  const now = new Date('2026-08-10T00:00:00Z');

  it('is overdue when sent, past due date, and balance remains', () => {
    expect(
      isInvoiceOverdue({
        status: 'sent',
        dueDate: new Date('2026-08-01T00:00:00Z'),
        balanceDue: 100,
        now,
      }),
    ).toBe(true);
  });

  it('is not overdue when balance is fully paid', () => {
    expect(
      isInvoiceOverdue({
        status: 'sent',
        dueDate: new Date('2026-08-01T00:00:00Z'),
        balanceDue: 0,
        now,
      }),
    ).toBe(false);
  });

  it('is not overdue when status is not sent', () => {
    expect(
      isInvoiceOverdue({
        status: 'paid',
        dueDate: new Date('2026-08-01T00:00:00Z'),
        balanceDue: 0,
        now,
      }),
    ).toBe(false);
  });

  it('is not overdue when due date is in the future', () => {
    expect(
      isInvoiceOverdue({
        status: 'sent',
        dueDate: new Date('2026-09-01T00:00:00Z'),
        balanceDue: 100,
        now,
      }),
    ).toBe(false);
  });
});

describe('canTransitionPaymentStatus', () => {
  it.each([
    ['pending', 'completed'],
    ['pending', 'failed'],
    ['completed', 'refunded'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransitionPaymentStatus(from, to)).toBe(true);
  });

  it('rejects transitions not in the documented diagram', () => {
    expect(canTransitionPaymentStatus('failed', 'completed')).toBe(false);
    expect(canTransitionPaymentStatus('refunded', 'completed')).toBe(false);
  });

  it('every terminal status has no outgoing transitions', () => {
    for (const status of PAYMENT_STATUSES) {
      if (status === 'failed' || status === 'refunded') {
        for (const target of PAYMENT_STATUSES) {
          expect(canTransitionPaymentStatus(status, target)).toBe(false);
        }
      }
    }
  });
});
