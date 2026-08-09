/**
 * Domain-level errors, framework-agnostic — see
 * docs/08-engineering/project-structure.md's domain/application/
 * infrastructure layering. apps/web's route handlers map these to the
 * documented API error codes (docs/05-api/errors.md) via `instanceof`
 * checks — see apps/web/lib/assets-errors.ts.
 */

export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * docs/05-api/authorization.md: an actor with an active Membership in the
 * target Organization but lacking the specific Permission for this action
 * — distinct from `NotFoundError`, which masks a resource the actor has
 * no Membership-based visibility into at all.
 */
export class ForbiddenError extends Error {
  constructor(message = 'Your role does not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * assets-prd.md §9: "Asset status: active -> removed/decommissioned
 * (terminal, but record remains visible in history — not a full state
 * machine, a one-way lifecycle flag)." Thrown when a transition is
 * attempted from a terminal status, or to an invalid target.
 */
export class InvalidAssetStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAssetStateError';
  }
}
