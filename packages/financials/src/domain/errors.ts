export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found.`);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** estimates.md/invoices.md State Machine: an attempted transition not drawn in the documented diagram. */
export class InvalidEstimateStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEstimateStateError';
  }
}

export class InvalidInvoiceStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInvoiceStateError';
  }
}

export class InvalidPaymentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPaymentStateError';
  }
}

/** estimates.md business rule 4: "An expired ... Estimate cannot be approved." */
export class EstimateExpiredError extends Error {
  constructor() {
    super('This Estimate has expired and can no longer be approved.');
    this.name = 'EstimateExpiredError';
  }
}

/** estimates.md business rule 2: once `sent`, line items are immutable. */
export class EstimateLineItemsImmutableError extends Error {
  constructor() {
    super(
      'This Estimate has been sent; its line items can no longer be edited directly. Create a new version instead.',
    );
    this.name = 'EstimateLineItemsImmutableError';
  }
}

/** invoices.md business rule 1: once finalized, line items/totals/customer_id/job_id are immutable. */
export class InvoiceIsImmutableError extends Error {
  constructor() {
    super(
      'This Invoice has been finalized and can no longer be edited. Use a Credit Note or Void instead.',
    );
    this.name = 'InvoiceIsImmutableError';
  }
}

/** invoices.md business rule 3: cannot finalize while the parent Job isn't completed (except deposit Invoices). */
export class InvoiceNotFinalizableError extends Error {
  constructor(message = 'This Invoice cannot be finalized: the parent Job is not yet completed.') {
    super(message);
    this.name = 'InvoiceNotFinalizableError';
  }
}

/** invoices.md business rule 1: a finalized Invoice can only be voided before any Payment has been applied. */
export class InvoiceHasPaymentsError extends Error {
  constructor() {
    super('This Invoice has recorded Payments and can no longer be voided.');
    this.name = 'InvoiceHasPaymentsError';
  }
}

/**
 * payments.md business rule 4: the application-layer half of the
 * database-check pair — see packages/database/migrations/
 * 0022_financials_payment_sum_check.sql for the DB-level enforcement of
 * the same invariant.
 */
export class PaymentExceedsInvoiceBalanceError extends Error {
  constructor() {
    super('This Payment amount would exceed the Invoice balance due.');
    this.name = 'PaymentExceedsInvoiceBalanceError';
  }
}
