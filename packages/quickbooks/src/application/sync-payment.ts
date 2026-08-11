import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { recordQuickBooksPayment } from '@atlas/integrations';
import { findConnection } from '../infrastructure/connections';
import { findSyncRecordByEntity, upsertSyncRecord } from '../infrastructure/sync-records';

export interface SyncPaymentToQuickBooksParams {
  organizationId: string;
  paymentId: string;
  invoiceId: string;
  totalAmt: number;
}

/**
 * integrations-prd.md §8: "sync ... completed Payments" — applied against
 * the Invoice's own QuickBooks record, so the Invoice must already have
 * synced successfully (`sync_records` row with `status = 'synced'`); if
 * not, this Payment is recorded `failed` with a clear reason rather than
 * silently skipped, since integrations-prd.md §13 requires sync errors to
 * be visible. Called by apps/worker/src/handlers/quickbooks-sync.ts —
 * same `withServiceContext`/no-connection-is-a-no-op treatment as
 * `syncInvoiceToQuickBooks`.
 */
export async function syncPaymentToQuickBooks(
  db: DatabaseClient,
  params: SyncPaymentToQuickBooksParams,
): Promise<void> {
  return withServiceContext(db, async (tx) => {
    const connection = await findConnection(tx, params.organizationId, 'quickbooks');
    if (!connection || connection.status !== 'connected' || !connection.accessToken || !connection.realmId) {
      return;
    }

    const invoiceSyncRecord = await findSyncRecordByEntity(tx, {
      provider: 'quickbooks',
      entityType: 'invoice',
      entityId: params.invoiceId,
    });
    if (!invoiceSyncRecord || invoiceSyncRecord.status !== 'synced' || !invoiceSyncRecord.externalId) {
      await upsertSyncRecord(tx, {
        organizationId: params.organizationId,
        provider: 'quickbooks',
        entityType: 'payment',
        entityId: params.paymentId,
        status: 'failed',
        errorDetail: 'Underlying Invoice has not synced to QuickBooks yet.',
      });
      return;
    }

    try {
      const result = await recordQuickBooksPayment({
        accessToken: connection.accessToken,
        realmId: connection.realmId,
        quickBooksInvoiceId: invoiceSyncRecord.externalId,
        totalAmt: params.totalAmt,
      });
      await upsertSyncRecord(tx, {
        organizationId: params.organizationId,
        provider: 'quickbooks',
        entityType: 'payment',
        entityId: params.paymentId,
        status: 'synced',
        externalId: result.quickBooksPaymentId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await upsertSyncRecord(tx, {
        organizationId: params.organizationId,
        provider: 'quickbooks',
        entityType: 'payment',
        entityId: params.paymentId,
        status: 'failed',
        errorDetail: message,
      });
    }
  });
}
