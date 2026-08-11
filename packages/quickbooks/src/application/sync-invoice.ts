import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { createQuickBooksInvoice, type QuickBooksLineItem } from '@atlas/integrations';
import { findConnection } from '../infrastructure/connections';
import { upsertSyncRecord } from '../infrastructure/sync-records';

export interface SyncInvoiceToQuickBooksParams {
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  lineItems: QuickBooksLineItem[];
}

/**
 * integrations-prd.md §8: "Sync is triggered by the same
 * `invoice.finalized`... domain event used for Notifications, processed
 * by the Worker, never inline in the request path. A sync failure never
 * blocks or reverses the underlying Atlas Invoice." Called by
 * apps/worker/src/handlers/quickbooks-sync.ts. Runs under
 * `withServiceContext` — the Worker has no authenticated request to scope
 * RLS to, and `integrations.sync_records` has no INSERT/UPDATE policy for
 * `authenticated` at all (migration 0028) — same "Worker-only write"
 * pattern as `@atlas/notifications`'s `sendNotification`. A missing/
 * disconnected connection is a silent no-op, not an error — there is
 * nothing to sync to.
 */
export async function syncInvoiceToQuickBooks(
  db: DatabaseClient,
  params: SyncInvoiceToQuickBooksParams,
): Promise<void> {
  return withServiceContext(db, async (tx) => {
    const connection = await findConnection(tx, params.organizationId, 'quickbooks');
    if (!connection || connection.status !== 'connected' || !connection.accessToken || !connection.realmId) {
      return;
    }

    try {
      const result = await createQuickBooksInvoice({
        accessToken: connection.accessToken,
        realmId: connection.realmId,
        docNumber: params.invoiceNumber,
        lineItems: params.lineItems,
      });
      await upsertSyncRecord(tx, {
        organizationId: params.organizationId,
        provider: 'quickbooks',
        entityType: 'invoice',
        entityId: params.invoiceId,
        status: 'synced',
        externalId: result.quickBooksInvoiceId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await upsertSyncRecord(tx, {
        organizationId: params.organizationId,
        provider: 'quickbooks',
        entityType: 'invoice',
        entityId: params.invoiceId,
        status: 'failed',
        errorDetail: message,
      });
    }
  });
}
