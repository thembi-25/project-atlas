import { sql } from 'drizzle-orm';
import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { processStripeWebhookEvent } from '@atlas/financials';
import type { StripeWebhookEvent } from '@atlas/integrations';
import { logger } from './logger';

type UnprocessedStripeEventRow = {
  id: string;
  payload: StripeWebhookEvent;
};

/**
 * Drains `platform.stripe_webhook_events` — docs/05-api/webhooks.md's
 * mandated pattern: the route handler only verifies the signature and
 * persists the raw event; actual processing happens here, never inline
 * in the route. A plain polling table-drain (not a pg-boss queue): unlike
 * Atlas's own multi-type `domain_events` outbox, this is a single
 * external inbox with one job (call `processStripeWebhookEvent`), so a
 * second queueing layer on top would add nothing.
 */
export async function processUnhandledStripeWebhookEvents(db: DatabaseClient): Promise<number> {
  const rows = await withServiceContext(db, (tx) =>
    tx.execute<UnprocessedStripeEventRow>(sql`
      SELECT id, payload
      FROM platform.stripe_webhook_events
      WHERE processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 50
    `),
  );

  for (const row of rows) {
    try {
      await withServiceContext(db, (tx) => processStripeWebhookEvent(tx, row.payload));
      await withServiceContext(db, (tx) =>
        tx.execute(sql`
          UPDATE platform.stripe_webhook_events
          SET processed_at = now()
          WHERE id = ${row.id}::uuid
        `),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process Stripe webhook event', { id: row.id, error: message });
    }
  }
  return rows.length;
}
