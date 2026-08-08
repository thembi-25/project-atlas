/**
 * Domain-level errors, framework-agnostic (no HTTP status codes here — see
 * docs/08-engineering/project-structure.md's domain/application/
 * infrastructure layering). apps/web's route handlers map these to the
 * documented API error codes (docs/05-api/errors.md) via `instanceof`
 * checks — see apps/web/lib/identity-errors.ts.
 */

export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = 'NotFoundError';
  }
}

/** Identity PRD §16: duplicate invitation to an already-active Membership. */
export class DuplicateInvitationError extends Error {
  constructor() {
    super('This person already has an active or pending Membership in this Organization.');
    this.name = 'DuplicateInvitationError';
  }
}

/** Identity PRD §16: expired or already-used invitation token. */
export class InvitationTokenInvalidError extends Error {
  constructor(reason: 'expired' | 'not_found' | 'already_used') {
    super(`Invitation token is invalid (${reason}).`);
    this.name = 'InvitationTokenInvalidError';
  }
}
