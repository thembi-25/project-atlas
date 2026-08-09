import {
  ForbiddenError,
  InvalidScheduleWindowError,
  JobNotDispatchableError,
  JobNotSchedulableError,
  NotFoundError,
  RescheduleReasonRequiredError,
} from '@atlas/scheduling';
import { AppError } from './errors';

/**
 * Maps @atlas/scheduling's framework-agnostic domain errors onto the
 * documented API error catalog (docs/05-api/errors.md) — mirrors
 * apps/web/lib/jobs-errors.ts's pattern.
 */
export function mapSchedulingError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof ForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  if (error instanceof JobNotSchedulableError || error instanceof JobNotDispatchableError) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof InvalidScheduleWindowError) {
    return new AppError('validation_error', error.message, [
      { field: 'scheduled_end', issue: 'must_be_after_scheduled_start' },
    ]);
  }
  if (error instanceof RescheduleReasonRequiredError) {
    return new AppError('validation_error', error.message, [
      { field: 'reason', issue: 'required' },
    ]);
  }
  return undefined;
}
