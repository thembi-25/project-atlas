/**
 * Jobs & Tasks domain module — the central operational entity of Core
 * Operations. See docs/13-roadmap/sprint-4.md, docs/03-domain/jobs.md,
 * docs/03-domain/tasks.md, docs/06-modules/jobs-prd.md.
 *
 * Other packages/apps import only from here, never from
 * src/{domain,application,infrastructure}/* directly — see
 * docs/08-engineering/project-structure.md, "Rule: no cross-package deep
 * imports."
 *
 * Architecture note: component-architecture.md's module table defines a
 * single "jobs" module owning `jobs, tasks, scheduling, dispatch`
 * together, but Sprint 0 scaffolded two separate TypeScript packages,
 * @atlas/jobs and @atlas/scheduling (package.json descriptions: "Jobs
 * and Tasks" / "Scheduling and Dispatch"). This mirrors Sprint 3's
 * @atlas/properties + @atlas/assets resolution exactly (see that
 * package's index.ts): both packages jointly implement the one
 * documented "jobs" module, sharing a single Postgres `jobs` schema.
 * @atlas/scheduling's infrastructure queries `jobs.jobs` directly where
 * needed (e.g. verifying a Job exists/belongs to the Organization before
 * scheduling it), and calls this package's `transitionJobStatusInTx` to
 * drive the Job to `scheduled`/`dispatched` atomically within its own
 * transaction, reusing the documented state machine rather than
 * re-implementing it. Genuinely separate modules (crm, properties,
 * financials) continue to go through this package's exported
 * application-layer functions only.
 */

// Domain
export {
  NotFoundError,
  ForbiddenError,
  InvalidJobStateError,
  IncompleteRequiredTasksError,
  JobIsImmutableError,
} from './domain/errors';
export {
  canTransitionJobStatus,
  isTerminalJobStatus,
  JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  type JobStatus,
} from './domain/lifecycle';

// Application use cases
export { createJob } from './application/create-job';
export type { CreateJobParams, CreateJobResult } from './application/create-job';
export {
  getJob,
  listJobs,
  searchJobs,
  updateJob,
  archiveJob,
  restoreJob,
} from './application/manage-job';
export type {
  GetJobParams,
  ListJobsParams,
  SearchJobsParams,
  UpdateJobParams,
  ArchiveJobParams,
  RestoreJobParams,
} from './application/manage-job';
export {
  transitionJobStatusInTx,
  startJob,
  holdJob,
  resumeJob,
  completeJob,
  cancelJob,
} from './application/transition-job';
export type {
  TransitionJobStatusParams,
  StartJobParams,
  HoldJobParams,
  ResumeJobParams,
  CompleteJobParams,
  CancelJobParams,
} from './application/transition-job';
export { listTasks, addAdHocTask, completeTask, reopenTask } from './application/manage-tasks';
export type {
  ListTasksParams,
  AddAdHocTaskParams,
  CompleteTaskParams,
  ReopenTaskParams,
} from './application/manage-tasks';
export {
  assignUserToJob,
  unassignUserFromJob,
  listAssignmentsForJob,
} from './application/manage-assignments';
export type {
  AssignUserToJobParams,
  UnassignUserFromJobParams,
  ListJobAssignmentsParams,
} from './application/manage-assignments';
export {
  attachAssetToJob,
  detachAssetFromJob,
  listAssetsForJob,
} from './application/manage-job-assets';
export type {
  AttachAssetToJobParams,
  DetachAssetFromJobParams,
  ListJobAssetsParams,
} from './application/manage-job-assets';
export { getJobHistory } from './application/job-history';
export type { GetJobHistoryParams, JobHistoryResult } from './application/job-history';
export { listJobTypes, listServiceCategories } from './application/list-job-types';
export type { ListJobTypesParams } from './application/list-job-types';
export { requireJobsPermission } from './application/authorize';

// Infrastructure types (read-only shapes useful to route handlers building responses)
export type {
  Job,
  JobCursor,
  JobPriority,
  JobSearchHit,
  JobSortField,
  JobSource,
  SortDirection,
} from './infrastructure/jobs';
export type { JobAssignment } from './infrastructure/job-assignments';
export type { JobAsset } from './infrastructure/job-assets';
export type { JobStatusHistoryEntry } from './infrastructure/job-status-history';
export type { Task, TaskType } from './infrastructure/tasks';
export type { JobType } from './infrastructure/job-types';
export type { ServiceCategory } from './infrastructure/service-categories';

// Cross-module composable reads (see e.g. @atlas/crm's findCustomerForOrganization)
export { findJobById } from './infrastructure/jobs';
export { isUserAssignedToJob } from './infrastructure/job-assignments';
