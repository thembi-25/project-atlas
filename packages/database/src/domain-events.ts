import type { DatabaseClient } from './client';
import * as schema from './schema';

/**
 * The transactional-outbox write helper — ADR-011, ADR-016,
 * docs/02-architecture/event-driven-architecture.md's "Event catalog
 * (launch scope)". Lives in @atlas/database (not a domain package) since
 * more than one producing module needs it (e.g. @atlas/jobs's
 * `completeJob` emits `job.completed`; @atlas/financials emits
 * `estimate.approved`/`invoice.finalized`/`payment.received`) and a
 * domain package cannot depend on another domain package that itself
 * depends back on it. Callers pass the SAME `tx` they are already
 * writing their own state change in, so the outbox row commits or rolls
 * back atomically with it — the entire point of the outbox pattern.
 * `apps/worker`'s dispatcher (not this function) is what actually calls
 * pg-boss's `boss.send()`, polling this table under `withServiceContext`.
 */
export interface RecordDomainEventParams {
  organizationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export async function recordDomainEvent(
  tx: DatabaseClient,
  params: RecordDomainEventParams,
): Promise<void> {
  await tx.insert(schema.domainEvents).values({
    organizationId: params.organizationId,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    payload: params.payload,
  });
}
