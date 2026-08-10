import { sql } from 'drizzle-orm';
import { withServiceContext, type DatabaseClient } from '@atlas/database';
import type PgBoss from 'pg-boss';
import { logger } from './logger';

/**
 * The transactional-outbox relay — ADR-011, ADR-016. Every event type in
 * the documented catalog (docs/02-architecture/event-driven-
 * architecture.md) gets its own pg-boss queue created here, whether or
 * not a consumer is registered yet: the relay's job is to reliably move
 * rows out of `platform.domain_events` into pg-boss, decoupled from
 * whether a consumer exists — a future module (e.g. Notifications,
 * Sprint 7) can start consuming `estimate.approved`/`invoice.finalized`/
 * `payment.received` without any change here. `job.dispatched` is
 * excluded (see docs/13-roadmap/sprint-5.md — no consumer justifies it
 * yet, and Sprint 4's scheduling code stays untouched).
 */
export const DOMAIN_EVENT_QUEUES = [
  'job.completed',
  'estimate.approved',
  'invoice.finalized',
  'payment.received',
] as const;

export async function ensureDomainEventQueues(boss: PgBoss): Promise<void> {
  for (const name of DOMAIN_EVENT_QUEUES) {
    await boss.createQueue(name);
  }
}

type PendingDomainEventRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  organization_id: string;
};

/**
 * Polls `platform.domain_events` for `status = 'pending'` rows and
 * relays each to pg-boss's `boss.send()`. Deliberately two short,
 * separate `withServiceContext` transactions per row (read, then mark
 * dispatched) rather than one long transaction spanning the network call
 * to pg-boss — holding a row lock across an external call would be an
 * unnecessary contention risk for no benefit at this sprint's single-
 * Worker-process scale.
 */
export async function dispatchPendingDomainEvents(
  db: DatabaseClient,
  boss: PgBoss,
): Promise<number> {
  const rows = await withServiceContext(db, (tx) =>
    tx.execute<PendingDomainEventRow>(sql`
      SELECT id, event_type, entity_type, entity_id, payload, organization_id
      FROM platform.domain_events
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 100
    `),
  );

  for (const row of rows) {
    try {
      await boss.send(row.event_type, {
        domainEventId: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        organizationId: row.organization_id,
        ...row.payload,
      });
      await withServiceContext(db, (tx) =>
        tx.execute(sql`
          UPDATE platform.domain_events
          SET status = 'dispatched', dispatched_at = now()
          WHERE id = ${row.id}::uuid
        `),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to dispatch domain event', {
        id: row.id,
        eventType: row.event_type,
        error: message,
      });
      await withServiceContext(db, (tx) =>
        tx.execute(sql`
          UPDATE platform.domain_events
          SET status = 'failed', attempts = attempts + 1, last_error = ${message}
          WHERE id = ${row.id}::uuid
        `),
      );
    }
  }
  return rows.length;
}
