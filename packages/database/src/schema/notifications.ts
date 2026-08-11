import { sql } from 'drizzle-orm';
import { boolean, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './org';
import { users } from './identity';
import { contacts } from './crm';

/**
 * Notifications domain (Sprint 7) — see docs/03-domain notifications
 * coverage folded into docs/06-modules/notifications-prd.md (no separate
 * docs/03-domain/notifications.md exists; the PRD is the sole source),
 * docs/13-roadmap/sprint-7.md, docs/02-architecture/event-driven-
 * architecture.md's event catalog. Maps to @atlas/notifications.
 *
 * `event_type` is `text`, not an enum, mirroring `platform.domain_events
 * .event_type`'s identical choice — the event catalog is expected to
 * grow as later phases add modules, and a text column avoids a migration
 * for every new event type.
 */
export const notificationsSchema = pgSchema('notifications');

export const notificationOwnerTypeEnum = notificationsSchema.enum('notification_owner_type', [
  'user',
  'contact',
]);

export const notificationChannelEnum = notificationsSchema.enum('notification_channel', [
  'email',
  'sms',
]);

/** notifications-prd.md, "State machines": `queued -> sent -> delivered/bounced/failed`. */
export const notificationStatusEnum = notificationsSchema.enum('notification_status', [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'failed',
]);

/**
 * The send log — notifications-prd.md Data requirements. Distinct from
 * `platform.audit_events` (that's the state-change record; this is the
 * operational delivery record) per notifications-prd.md's own Audit
 * requirements section.
 */
export const notifications = notificationsSchema.table('notifications', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  recipientType: notificationOwnerTypeEnum('recipient_type').notNull(),
  recipientUserId: uuid('recipient_user_id').references(() => users.id),
  recipientContactId: uuid('recipient_contact_id').references(() => contacts.id),
  eventType: text('event_type').notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  status: notificationStatusEnum('status').notNull().default('queued'),
  subject: text('subject'),
  body: text('body').notNull(),
  providerMessageId: text('provider_message_id'),
  errorDetail: text('error_detail'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-User/Contact channel preference per event type — notifications-
 * prd.md §11. Absence of a row for a given (owner, event_type, channel)
 * means enabled (opt-out model) — see @atlas/notifications's
 * `isChannelEnabled`. Two partial unique indexes (one per owner type)
 * substitute for a single composite unique index, since exactly one of
 * `ownerUserId`/`ownerContactId` is set per row depending on `ownerType`.
 */
export const notificationPreferences = notificationsSchema.table(
  'notification_preferences',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    ownerType: notificationOwnerTypeEnum('owner_type').notNull(),
    ownerUserId: uuid('owner_user_id').references(() => users.id),
    ownerContactId: uuid('owner_contact_id').references(() => contacts.id),
    eventType: text('event_type').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_notification_preferences_user')
      .on(table.ownerUserId, table.eventType, table.channel)
      .where(sql`${table.ownerType} = 'user'`),
    uniqueIndex('uq_notification_preferences_contact')
      .on(table.ownerContactId, table.eventType, table.channel)
      .where(sql`${table.ownerType} = 'contact'`),
  ],
);
