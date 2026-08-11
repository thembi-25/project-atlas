import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { revokeQuickBooksToken } from '@atlas/integrations';
import { NotFoundError } from '../domain/errors';
import { findConnection, markDisconnected, type IntegrationConnection } from '../infrastructure/connections';
import { requireIntegrationsAdminAccess } from './authorize';

export interface DisconnectQuickBooksParams {
  organizationId: string;
  actorUserId: string;
}

/**
 * integrations-prd.md §11 `DELETE /api/v1/integrations/quickbooks`,
 * §17 edge case: "in-flight sync jobs are cancelled cleanly;
 * already-synced records remain synced (no rollback)." No explicit
 * job-cancellation bookkeeping is needed — the Worker's sync consumer
 * (apps/worker/src/handlers/quickbooks-sync.ts) checks connection status
 * before every attempt, so once `status` flips to `disconnected` no
 * further sync attempt proceeds. Token revocation is best-effort: a
 * revocation failure (e.g. token already expired) must not block the
 * disconnect itself from completing.
 */
export async function disconnectQuickBooks(
  db: DatabaseClient,
  params: DisconnectQuickBooksParams,
): Promise<IntegrationConnection> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireIntegrationsAdminAccess(tx, params);
    const connection = await findConnection(tx, params.organizationId, 'quickbooks');
    if (!connection || connection.status === 'disconnected') {
      throw new NotFoundError('QuickBooks connection');
    }

    if (connection.refreshToken) {
      try {
        await revokeQuickBooksToken(connection.refreshToken);
      } catch {
        // Best-effort — see docstring above.
      }
    }

    return markDisconnected(tx, connection.id);
  });
}
