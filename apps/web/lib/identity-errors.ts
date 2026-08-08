import {
  DuplicateInvitationError,
  InvalidMembershipTransitionError,
  InvitationTokenInvalidError,
  LastOwnerProtectionError,
  NotFoundError,
} from '@atlas/identity';
import { AppError } from './errors';

/**
 * Maps @atlas/identity's framework-agnostic domain errors onto the
 * documented API error catalog (docs/05-api/errors.md). Keeping this
 * mapping in apps/web, not in @atlas/identity, keeps the domain package
 * free of any HTTP-layer concept — see
 * docs/08-engineering/project-structure.md's layering rule.
 */
export function mapIdentityError(error: unknown): AppError | undefined {
  if (error instanceof NotFoundError) {
    return new AppError('not_found', error.message);
  }
  if (error instanceof DuplicateInvitationError) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof LastOwnerProtectionError) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof InvalidMembershipTransitionError) {
    return new AppError('conflict', error.message);
  }
  if (error instanceof InvitationTokenInvalidError) {
    return new AppError('validation_error', error.message);
  }
  return undefined;
}
