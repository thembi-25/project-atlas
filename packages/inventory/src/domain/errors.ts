/**
 * Domain-level errors, framework-agnostic — see
 * docs/08-engineering/project-structure.md's domain/application/
 * infrastructure layering. apps/web's route handlers map these to the
 * documented API error codes (docs/05-api/errors.md) via `instanceof`
 * checks — see apps/web/lib/inventory-errors.ts.
 */

export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found.`);
    this.name = 'NotFoundError';
  }
}

/**
 * docs/05-api/authorization.md: an actor with an active Membership in the
 * target Organization but lacking the specific Permission for this action.
 */
export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * inventory-prd.md §16: "adjusting stock with a non-numeric or
 * negative-for-a-`received`-type movement (422)"; inventory.md Edge
 * Cases: an `adjusted` movement requires a `notes` reason.
 */
export class InvalidStockMovementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStockMovementError';
  }
}
