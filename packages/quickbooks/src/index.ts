/**
 * QuickBooks Online integration-connection domain module — Sprint 7
 * (Core Operations MVP Hardening). See docs/06-modules/integrations-prd.md,
 * docs/13-roadmap/sprint-7.md.
 */

// Domain
export { NotFoundError, ForbiddenError } from './domain/errors';
export {
  generateOAuthState,
  verifyOAuthState,
  InvalidOAuthStateError,
  type QuickBooksOAuthState,
} from './domain/oauth-state';

// Infrastructure (read-only types useful to route handlers building responses)
export type { IntegrationConnection } from './infrastructure/connections';
export type { SyncRecord, SyncEntityType, ListSyncRecordsResult } from './infrastructure/sync-records';

// Application use cases
export { requireIntegrationsAdminAccess } from './application/authorize';
export { beginQuickBooksConnect, completeQuickBooksConnect } from './application/connect';
export type { BeginQuickBooksConnectParams, CompleteQuickBooksConnectParams } from './application/connect';
export { disconnectQuickBooks } from './application/disconnect';
export type { DisconnectQuickBooksParams } from './application/disconnect';
export { getQuickBooksSyncStatus } from './application/sync-status';
export type { GetQuickBooksSyncStatusParams, GetQuickBooksSyncStatusResult } from './application/sync-status';
export { syncInvoiceToQuickBooks } from './application/sync-invoice';
export type { SyncInvoiceToQuickBooksParams } from './application/sync-invoice';
export { syncPaymentToQuickBooks } from './application/sync-payment';
export type { SyncPaymentToQuickBooksParams } from './application/sync-payment';
