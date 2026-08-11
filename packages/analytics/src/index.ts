/**
 * Analytics and Reporting (basic) domain module for Project Atlas —
 * Sprint 7 (Core Operations MVP Hardening). See
 * docs/06-modules/analytics-prd.md, docs/03-domain/analytics.md,
 * docs/13-roadmap/sprint-7.md.
 */

// Domain
export { ForbiddenError } from './domain/errors';
export {
  describeStaleness,
  REFRESH_INTERVAL_MS,
  STALENESS_THRESHOLD_MS,
  type Staleness,
} from './domain/staleness';

// Application use cases
export { requireAnalyticsAccess, resolveTechnicianScope, type AnalyticsScope } from './application/authorize';
export { getRevenueByPeriod } from './application/get-revenue';
export type { GetRevenueByPeriodParams, GetRevenueByPeriodResult } from './application/get-revenue';
export { getJobVolumeByType } from './application/get-job-volume';
export type { GetJobVolumeByTypeParams, GetJobVolumeByTypeResult } from './application/get-job-volume';
export { getInvoiceAging } from './application/get-invoice-aging';
export type { GetInvoiceAgingParams, GetInvoiceAgingResult } from './application/get-invoice-aging';
export { getTechnicianUtilization } from './application/get-technician-utilization';
export type {
  GetTechnicianUtilizationParams,
  GetTechnicianUtilizationResult,
} from './application/get-technician-utilization';
export { refreshAllMaterializedViews, type RefreshViewOutcome } from './application/refresh-views';

// Infrastructure (row types useful to route handlers building responses)
export type { RevenueByPeriodRow } from './infrastructure/revenue';
export type { JobVolumeByTypeRow } from './infrastructure/job-volume';
export type { InvoiceAgingRow } from './infrastructure/invoice-aging';
export type { TechnicianUtilizationRow } from './infrastructure/technician-utilization';
export type { RefreshedViewName } from './infrastructure/refresh-log';
