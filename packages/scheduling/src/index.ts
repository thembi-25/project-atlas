/**
 * Scheduling & Dispatch domain module. See docs/13-roadmap/sprint-4.md,
 * docs/03-domain/scheduling.md, docs/03-domain/dispatch.md,
 * docs/06-modules/scheduling-prd.md, docs/06-modules/dispatch-prd.md.
 *
 * Other packages/apps import only from here, never from
 * src/{domain,application,infrastructure}/* directly — see
 * docs/08-engineering/project-structure.md, "Rule: no cross-package deep
 * imports."
 *
 * Architecture note: this package's infrastructure/application layers
 * query `jobs.jobs` directly (via @atlas/jobs's exported
 * `findJobById`/`isUserAssignedToJob`/`transitionJobStatusInTx`) rather
 * than treating Jobs as an arm's-length external module. See
 * @atlas/properties's index.ts and @atlas/jobs's index.ts for the full
 * "two packages, one architectural module" reasoning this mirrors.
 */

// Domain
export {
  NotFoundError,
  ForbiddenError,
  InvalidScheduleWindowError,
  JobNotSchedulableError,
  RescheduleReasonRequiredError,
  JobNotDispatchableError,
} from './domain/errors';
export { windowsOverlap } from './domain/conflict-detection';

// Application use cases
export { scheduleJob } from './application/schedule-job';
export type { ScheduleJobParams, ScheduleJobResult } from './application/schedule-job';
export { rescheduleJob } from './application/reschedule-job';
export type { RescheduleJobParams, RescheduleJobResult } from './application/reschedule-job';
export { dispatchJob } from './application/dispatch-job';
export type { DispatchJobParams, DispatchJobResult } from './application/dispatch-job';
export { acknowledgeDispatch, markEnRoute, markArrived } from './application/acknowledge-dispatch';
export type { RecordDispatchTimestampParams } from './application/acknowledge-dispatch';
export { listSchedule, getJobSchedule, getConflicts } from './application/list-schedule';
export type {
  ListScheduleParams,
  GetJobScheduleParams,
  GetConflictsParams,
} from './application/list-schedule';
export { requireSchedulingPermission } from './application/authorize';

// Infrastructure types (read-only shapes useful to route handlers building responses)
export type { ScheduleEvent } from './infrastructure/schedule-events';
export type { ScheduleEventAssignment } from './infrastructure/schedule-events';
export type { ScheduleEventHistoryEntry, ScheduleConflict } from './infrastructure/schedule-events';
export {
  listScheduleEventAssignments,
  listScheduleEventHistory,
} from './infrastructure/schedule-events';
export type { DispatchEvent } from './infrastructure/dispatch-events';
export { listDispatchEventsForJob } from './infrastructure/dispatch-events';
