import { ForbiddenError, InvalidAssetStateError, NotFoundError } from '@atlas/assets';
import { AppError } from './errors';

/**
 * Maps @atlas/assets's framework-agnostic domain errors onto the
 * documented API error catalog (docs/05-api/errors.md) — mirrors
 * apps/web/lib/crm-errors.ts's pattern.
 */
export function mapAssetsError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof ForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  if (error instanceof InvalidAssetStateError) {
    return new AppError('conflict', error.message);
  }
  return undefined;
}
