/**
 * State machines for Estimates, Invoices, and Payments — mirrors
 * @atlas/jobs's `domain/lifecycle.ts` pattern exactly (a pure lookup
 * table + predicate, no side effects). See docs/03-domain/estimates.md,
 * docs/03-domain/invoices.md, docs/03-domain/payments.md, "State machine".
 */

export const ESTIMATE_STATUSES = [
  'draft',
  'sent',
  'approved',
  'rejected',
  'expired',
  'converted',
  'cancelled',
] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const TERMINAL_ESTIMATE_STATUSES: EstimateStatus[] = [
  'rejected',
  'expired',
  'converted',
  'cancelled',
];

const ESTIMATE_TRANSITIONS: Record<EstimateStatus, EstimateStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['approved', 'rejected', 'expired', 'cancelled'],
  approved: ['converted'],
  rejected: [],
  expired: [],
  converted: [],
  cancelled: [],
};

export function canTransitionEstimateStatus(from: EstimateStatus, to: EstimateStatus): boolean {
  return ESTIMATE_TRANSITIONS[from].includes(to);
}

export function isTerminalEstimateStatus(status: EstimateStatus): boolean {
  return TERMINAL_ESTIMATE_STATUSES.includes(status);
}

export const INVOICE_STATUSES = [
  'draft',
  'finalized',
  'sent',
  'partially_paid',
  'paid',
  'void',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const TERMINAL_INVOICE_STATUSES: InvoiceStatus[] = ['paid', 'void'];

const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['finalized', 'void'],
  finalized: ['sent', 'void'],
  sent: ['partially_paid', 'paid'],
  partially_paid: ['paid'],
  paid: [],
  void: [],
};

export function canTransitionInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from].includes(to);
}

export function isTerminalInvoiceStatus(status: InvoiceStatus): boolean {
  return TERMINAL_INVOICE_STATUSES.includes(status);
}

/** invoices.md business rule 5: computed, never a stored state. */
export function isInvoiceOverdue(params: {
  status: InvoiceStatus;
  dueDate: Date | null;
  balanceDue: number;
  now?: Date;
}): boolean {
  if (params.status !== 'sent' || !params.dueDate) return false;
  const now = params.now ?? new Date();
  return params.dueDate.getTime() < now.getTime() && params.balanceDue > 0;
}

export const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['completed', 'failed'],
  completed: ['refunded'],
  failed: [],
  refunded: [],
};

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}
