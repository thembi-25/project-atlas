import {
  EstimateExpiredError,
  EstimateLineItemsImmutableError,
  ForbiddenError,
  InvalidEstimateStateError,
  InvalidInvoiceStateError,
  InvalidPaymentStateError,
  InvoiceHasPaymentsError,
  InvoiceIsImmutableError,
  InvoiceNotFinalizableError,
  NotFoundError,
  PaymentExceedsInvoiceBalanceError,
} from '@atlas/financials';
import { AppError } from './errors';

/**
 * Maps @atlas/financials's framework-agnostic domain errors onto the
 * documented API error catalog (docs/05-api/errors.md) — mirrors
 * apps/web/lib/jobs-errors.ts's pattern.
 */
export function mapFinancialsError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof ForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  if (
    error instanceof InvalidEstimateStateError ||
    error instanceof InvalidInvoiceStateError ||
    error instanceof InvalidPaymentStateError ||
    error instanceof EstimateLineItemsImmutableError ||
    error instanceof InvoiceIsImmutableError ||
    error instanceof InvoiceNotFinalizableError ||
    error instanceof InvoiceHasPaymentsError
  ) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof EstimateExpiredError || error instanceof PaymentExceedsInvoiceBalanceError) {
    return new AppError('validation_error', error.message);
  }
  return undefined;
}
