import {
  CustomerHasActiveRecordsError,
  ForbiddenError,
  InvalidCustomerStateError,
  NotFoundError,
} from '@atlas/crm';
import { AppError } from './errors';

/**
 * Maps @atlas/crm's framework-agnostic domain errors onto the documented
 * API error catalog (docs/05-api/errors.md) — mirrors
 * apps/web/lib/identity-errors.ts's pattern.
 */
export function mapCrmError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof ForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  if (error instanceof CustomerHasActiveRecordsError) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof InvalidCustomerStateError) {
    return new AppError('conflict', error.message);
  }
  return undefined;
}
