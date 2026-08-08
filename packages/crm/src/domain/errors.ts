/**
 * Domain-level errors, framework-agnostic (no HTTP status codes here — see
 * docs/08-engineering/project-structure.md's domain/application/
 * infrastructure layering). apps/web's route handlers map these to the
 * documented API error codes (docs/05-api/errors.md) via `instanceof`
 * checks — see apps/web/lib/crm-errors.ts.
 */

export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * docs/05-api/authorization.md: an actor with an active Membership in the
 * target Organization (so its existence is already known to them) but
 * lacking the specific Permission for this action — distinct from
 * `NotFoundError`, which masks a resource the actor has no Membership-based
 * visibility into at all (cross-tenant masking only applies there).
 */
export class ForbiddenError extends Error {
  constructor(message = 'Your role does not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * customers-prd.md §16: "Deleting a Customer with active Jobs (409)." Jobs
 * do not exist yet (out of scope this sprint — see
 * SPRINT-2-COMPLETION-REPORT.md, "Known Limitations"), so this error type
 * exists for the documented contract but the Job-based check itself is
 * not wired up until the Jobs module exists.
 */
export class CustomerHasActiveRecordsError extends Error {
  constructor() {
    super('This Customer has active records and cannot be deleted.');
    this.name = 'CustomerHasActiveRecordsError';
  }
}

/**
 * contacts.md business rule 2 / constraints.md `uq_contacts_customer_primary`:
 * at most one primary Contact per Customer. The database's partial unique
 * index is the ultimate backstop; this error lets the application layer
 * reject the same condition earlier with a clear message.
 */
export class InvalidCustomerStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCustomerStateError';
  }
}
