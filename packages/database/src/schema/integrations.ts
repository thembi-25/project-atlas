import { sql } from 'drizzle-orm';
import { pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './org';
import { users } from './identity';

/**
 * Third-party integration connections (Sprint 7) — see docs/06-modules/
 * integrations-prd.md, docs/11-adr/ADR-019-third-party-integrations.md,
 * docs/13-roadmap/sprint-7.md. Maps to @atlas/integrations's QuickBooks
 * client plus a thin `integrations` application surface (no dedicated
 * package — this sprint's QuickBooks scope is a connect/disconnect flow
 * and sync-record tracking exposed directly from apps/web, mirroring how
 * thin the actual PRD requirement is; a dedicated domain package would be
 * premature for a single provider with no business logic beyond
 * connect/disconnect/sync-status).
 */
export const integrationsSchema = pgSchema('integrations');

/** Single value today (QuickBooks Online); an enum, not text, since integrations-prd.md documents this as a fixed, reviewed provider catalog — a new provider is a deliberate addition, not user-defined data. */
export const integrationProviderEnum = integrationsSchema.enum('integration_provider', [
  'quickbooks',
]);

export const integrationConnectionStatusEnum = integrationsSchema.enum(
  'integration_connection_status',
  ['connected', 'disconnected'],
);

/** integrations-prd.md §10: "OAuth token references — encrypted at rest." No application-layer field encryption is added this sprint (see the Sprint 7 completion report, Known Limitations) — tokens rely on Supabase's disk-level encryption only, the same baseline every other secret-adjacent column in this codebase relies on. */
export const integrationConnections = integrationsSchema.table('integration_connections', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  provider: integrationProviderEnum('provider').notNull(),
  status: integrationConnectionStatusEnum('status').notNull().default('disconnected'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  realmId: text('realm_id'),
  connectedByUserId: uuid('connected_by_user_id').references(() => users.id),
  connectedAt: timestamp('connected_at', { withTimezone: true }),
  disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** integrations-prd.md §9: `pending -> synced/failed` per entity. `(provider, entity_type, entity_id)` unique — idempotent-sync tests rely on this: a redelivered sync attempt updates the existing row rather than creating a duplicate. */
export const syncStatusEnum = integrationsSchema.enum('sync_status', [
  'pending',
  'synced',
  'failed',
]);

export const syncRecords = integrationsSchema.table(
  'sync_records',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    provider: integrationProviderEnum('provider').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    status: syncStatusEnum('status').notNull().default('pending'),
    externalId: text('external_id'),
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),
    errorDetail: text('error_detail'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_sync_records_provider_entity').on(
      table.provider,
      table.entityType,
      table.entityId,
    ),
  ],
);
