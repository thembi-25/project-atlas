import {
  BuildingHasActiveRecordsError,
  ForbiddenError,
  NotFoundError,
  PossibleDuplicatePropertyError,
  PropertyHasActiveRecordsError,
  RoomHasActiveRecordsError,
} from '@atlas/properties';
import { AppError } from './errors';

/**
 * Maps @atlas/properties's framework-agnostic domain errors onto the
 * documented API error catalog (docs/05-api/errors.md) — mirrors
 * apps/web/lib/crm-errors.ts's pattern.
 */
export function mapPropertiesError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof ForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  if (
    error instanceof PropertyHasActiveRecordsError ||
    error instanceof BuildingHasActiveRecordsError ||
    error instanceof RoomHasActiveRecordsError
  ) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof PossibleDuplicatePropertyError) {
    return new AppError('validation_error', error.message, [
      { field: 'address_line1', issue: 'possible_duplicate' },
    ]);
  }
  return undefined;
}
