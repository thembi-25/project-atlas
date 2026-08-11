import { ForbiddenError, InvalidOAuthStateError, NotFoundError } from '@atlas/quickbooks';
import { AppError } from './errors';

/**
 * Maps @atlas/quickbooks's framework-agnostic domain errors onto the
 * documented API error catalog (docs/05-api/errors.md) — mirrors
 * apps/web/lib/financials-errors.ts's pattern.
 */
export function mapQuickBooksError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof ForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  if (error instanceof InvalidOAuthStateError) {
    return new AppError('validation_error', error.message);
  }
  return undefined;
}
