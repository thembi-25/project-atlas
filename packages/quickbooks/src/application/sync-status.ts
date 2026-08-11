import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findConnection, type IntegrationConnection } from '../infrastructure/connections';
import { listSyncRecordsForOrganization, type ListSyncRecordsResult } from '../infrastructure/sync-records';
import { requireIntegrationsAdminAccess } from './authorize';

export interface GetQuickBooksSyncStatusParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: { sortValue: string; id: string } | undefined;
}

export interface GetQuickBooksSyncStatusResult {
  connection: IntegrationConnection | undefined;
  syncRecords: ListSyncRecordsResult;
}

/** integrations-prd.md §11 `GET /api/v1/integrations/quickbooks/sync-status`, §13 "sync-status/error visibility." */
export async function getQuickBooksSyncStatus(
  db: DatabaseClient,
  params: GetQuickBooksSyncStatusParams,
): Promise<GetQuickBooksSyncStatusResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireIntegrationsAdminAccess(tx, params);
    const [connection, syncRecords] = await Promise.all([
      findConnection(tx, params.organizationId, 'quickbooks'),
      listSyncRecordsForOrganization(tx, {
        organizationId: params.organizationId,
        provider: 'quickbooks',
        limit: params.limit,
        cursor: params.cursor,
      }),
    ]);
    return { connection, syncRecords };
  });
}
