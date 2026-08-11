import { ForbiddenError } from '@atlas/analytics';
import { AppError } from './errors';

/**
 * Maps @atlas/analytics's framework-agnostic domain errors onto the
 * documented API error catalog (docs/05-api/errors.md) — mirrors
 * apps/web/lib/financials-errors.ts's pattern.
 */
export function mapAnalyticsError(error: unknown): AppError | undefined {
  if (error instanceof ForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  return undefined;
}
