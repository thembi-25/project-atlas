/**
 * The documented Job state machine — docs/03-domain/jobs.md#state-machine.
 * `completed` and `cancelled` are terminal: "no transition out of them is
 * permitted" (jobs.md, immediately below the diagram).
 */
export const JOB_STATUSES = [
  'draft',
  'scheduled',
  'dispatched',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ['completed', 'cancelled'];

/** Exactly the edges drawn in jobs.md's state-machine diagram — no invented states or shortcuts. */
const VALID_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['dispatched', 'cancelled'],
  dispatched: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransitionJobStatus(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}
