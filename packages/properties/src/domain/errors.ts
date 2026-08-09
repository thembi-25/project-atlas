/**
 * Domain-level errors, framework-agnostic — see
 * docs/08-engineering/project-structure.md's domain/application/
 * infrastructure layering. apps/web's route handlers map these to the
 * documented API error codes (docs/05-api/errors.md) via `instanceof`
 * checks — see apps/web/lib/properties-errors.ts.
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
 * properties.md business rule 4: "Deleting a Property is a soft delete
 * and is blocked while the Property has any non-deleted Job, Asset, or
 * Building/Room referencing it." Jobs does not exist yet this sprint, so
 * only the Building/Asset check is enforced — see
 * docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Known Limitations."
 */
export class PropertyHasActiveRecordsError extends Error {
  constructor() {
    super('This Property has active Buildings or Assets and cannot be deleted.');
    this.name = 'PropertyHasActiveRecordsError';
  }
}

/** buildings.md business rule 2: blocked while it has any non-deleted Room or Asset. */
export class BuildingHasActiveRecordsError extends Error {
  constructor() {
    super('This Building has active Rooms or Assets and cannot be deleted.');
    this.name = 'BuildingHasActiveRecordsError';
  }
}

/** rooms.md business rule 2: blocked while it has any non-deleted Asset directly located in it. */
export class RoomHasActiveRecordsError extends Error {
  constructor() {
    super('This Room has active Assets and cannot be deleted.');
    this.name = 'RoomHasActiveRecordsError';
  }
}

/**
 * properties-prd.md §16: "creating a duplicate address without
 * acknowledging the duplicate-detection prompt (422 with a
 * possible_duplicate detail)." Carries the matched candidates so the API
 * layer can surface them in the error response.
 */
export class PossibleDuplicatePropertyError extends Error {
  constructor(public readonly duplicates: readonly { id: string; addressLine1: string }[]) {
    super('A Property with a similar address may already exist.');
    this.name = 'PossibleDuplicatePropertyError';
  }
}
