export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found.`);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** scheduling.md, Key attributes: "a time window, not a single instant" — `scheduled_end` must be after `scheduled_start`. */
export class InvalidScheduleWindowError extends Error {
  constructor(message = 'scheduled_end must be after scheduled_start.') {
    super(message);
    this.name = 'InvalidScheduleWindowError';
  }
}

/** scheduling.md business rule 1: scheduling requires the Job to be in `draft` or `scheduled` status. */
export class JobNotSchedulableError extends Error {
  constructor(status: string) {
    super(`Cannot schedule a Job in "${status}" status.`);
    this.name = 'JobNotSchedulableError';
  }
}

/** scheduling.md business rule 3: rescheduling a `dispatched`/`in_progress` Job requires an explicit reason. */
export class RescheduleReasonRequiredError extends Error {
  constructor() {
    super('A reason is required to reschedule a dispatched or in-progress Job.');
    this.name = 'RescheduleReasonRequiredError';
  }
}

/** dispatch.md business rule 1: a Job can only be dispatched from `scheduled` status. */
export class JobNotDispatchableError extends Error {
  constructor(status: string) {
    super(`Cannot dispatch a Job in "${status}" status.`);
    this.name = 'JobNotDispatchableError';
  }
}
