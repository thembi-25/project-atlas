import { sql } from 'drizzle-orm';
import {
  index,
  inet,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
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

export const auditActorTypeEnum = platformSchema.enum('audit_actor_type', [
  'user',
  'system',
  'api_key',
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
