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

/** jobs.md, State Machine: an attempted transition not drawn in the documented diagram. */
export class InvalidJobStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJobStateError';
  }
}

/**
 * jobs.md business rule 3 / jobs-prd.md §16: "completing a Job with an
 * incomplete required Task and no override (422)".
 */
export class IncompleteRequiredTasksError extends Error {
  readonly taskLabels: string[];
  constructor(taskLabels: string[]) {
    super(`Cannot complete this Job: required Task(s) not done — ${taskLabels.join(', ')}.`);
    this.name = 'IncompleteRequiredTasksError';
    this.taskLabels = taskLabels;
  }
}

/**
 * jobs.md business rule 4: "Once completed, a Job's core facts... are
 * immutable; corrections go through a documented amendment, never a
 * silent edit." A full amendment workflow is out of this sprint's scope
 * (see SPRINT-4-COMPLETION-REPORT.md, "Known Limitations") — enforced
 * here by rejecting edits to a terminal-status Job outright.
 */
export class JobIsImmutableError extends Error {
  constructor() {
    super('This Job is in a terminal status and its core facts can no longer be edited.');
    this.name = 'JobIsImmutableError';
  }
}
