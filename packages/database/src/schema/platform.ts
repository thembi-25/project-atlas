import { sql } from 'drizzle-orm';
import {
  index,
  inet,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';

/**
 * Cross-cutting platform infrastructure: the audit log. See
 * docs/04-database/audit-logging.md, docs/11-adr/ADR-012-audit-logging.md,
 * docs/03-domain/audit-events.md.
 *
 * `audit_events` is partitioned by month (`occurred_at`) from its first
 * migration. Drizzle's schema builder describes the logical table shape;
 * partitioning, the audit trigger function, and per-table triggers are
 * DDL Drizzle Kit cannot express and are added in the accompanying raw SQL
 * migration (see migrations/0001_identity_organizations.sql).
 */
export const platformSchema = pgSchema('platform');

/**
 * `contact` added in Sprint 5 for the Customer Portal — a Contact acting
 * through the Portal is a genuine, distinct actor type from a staff
 * `user`, per docs/06-modules/customer-portal-prd.md ("audit events use
 * actor_type = 'contact'"). Since this enum was created in an
 * already-applied Sprint 1 migration, the new value is added via
 * `ALTER TYPE ... ADD VALUE` in a new Sprint 5 migration, never by editing
 * migrations/0001_identity_organizations.sql.
 */
export const auditActorTypeEnum = platformSchema.enum('audit_actor_type', [
  'user',
  'system',
  'api_key',
  'contact',
]);

export const auditActionEnum = platformSchema.enum('audit_action', [
  'create',
  'update',
  'delete',
  'state_transition',
]);

export const auditEvents = platformSchema.table(
  'audit_events',
  {
    id: uuid('id')
      .notNull()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id'),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: auditActorTypeEnum('actor_type').notNull().default('user'),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: auditActionEnum('action').notNull(),
    diff: jsonb('diff'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    requestId: uuid('request_id'),
    ipAddress: inet('ip_address'),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.occurredAt] }),
    index('idx_audit_events_organization_id_occurred_at').on(
      table.organizationId,
      table.occurredAt,
    ),
    index('idx_audit_events_entity_type_entity_id').on(table.entityType, table.entityId),
  ],
);

/**
 * Sprint 5's transactional outbox — see docs/11-adr/ADR-011-event-history.md,
 * docs/11-adr/ADR-016-background-jobs.md,
 * docs/02-architecture/event-driven-architecture.md's "Event catalog
 * (launch scope)". A producing module (e.g. `@atlas/jobs`'s `completeJob`)
 * writes a row here in the *same* Drizzle transaction as its state change,
 * guaranteeing the event is never lost if the process crashes between the
 * write and the queue publish. `apps/worker` runs a separate dispatcher
 * that polls `status = 'pending'` rows and calls pg-boss's `boss.send()`
 * per row — pg-boss cannot itself participate in an external Drizzle
 * transaction, so this two-step relay is the mechanism that achieves
 * ADR-011's "same transaction as the triggering write" guarantee. Distinct
 * from `audit_events`: audit events are synchronous and never queued; this
 * table exists specifically to feed asynchronous Worker consumers.
 *
 * No FK on `organizationId` — same reasoning as `audit_events` above (a
 * high-volume, append-mostly event table should not carry an FK-enforced
 * join on every insert).
 */
export const domainEventStatusEnum = platformSchema.enum('domain_event_status', [
  'pending',
  'dispatched',
  'failed',
]);

export const domainEvents = platformSchema.table(
  'domain_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id').notNull(),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload').notNull(),
    status: domainEventStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_domain_events_status_created_at').on(table.status, table.createdAt),
    index('idx_domain_events_organization_id').on(table.organizationId),
  ],
);

/**
 * Durable, deduplicated storage for inbound Stripe webhook events — see
 * docs/05-api/webhooks.md's mandated pattern: verify signature -> persist
 * the raw verified event (keyed by the provider's own event ID, for
 * at-least-once-delivery dedup) -> hand off processing to the Worker ->
 * respond 200 promptly. Distinct from Atlas's own `domain_events` outbox:
 * this table holds *external* Stripe events, not events Atlas produces.
 * No `organizationId`: at initial receipt (before processing) the
 * connection to an Atlas Organization is not yet resolved — the Worker
 * resolves it from the payload (e.g. the PaymentIntent's linked
 * `financials.payments.processor_reference_id`) during processing.
 */
export const stripeWebhookEvents = platformSchema.table(
  'stripe_webhook_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    stripeEventId: text('stripe_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_stripe_webhook_events_stripe_event_id').on(table.stripeEventId)],
);
