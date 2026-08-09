import {
  ForbiddenError,
  IncompleteRequiredTasksError,
  InvalidJobStateError,
  JobIsImmutableError,
  NotFoundError,
} from '@atlas/jobs';
import { AppError } from './errors';

/**
 * Maps @atlas/jobs's framework-agnostic domain errors onto the
 * documented API error catalog (docs/05-api/errors.md) — mirrors
 * apps/web/lib/properties-errors.ts's pattern.
 */
export function mapJobsError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof ForbiddenError) {
    return new AppError('forbidden', error.message);
  }
  if (error instanceof InvalidJobStateError || error instanceof JobIsImmutableError) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof IncompleteRequiredTasksError) {
    return new AppError(
      'validation_error',
      error.message,
      error.taskLabels.map((label) => ({ field: 'tasks', issue: label })),
    );
  }
  return undefined;
}
