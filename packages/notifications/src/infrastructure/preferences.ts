import { and, eq, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { NotificationChannel, NotificationEventType } from '../domain/event-catalog';
import type { OwnerRef } from './owner-ref';

export type NotificationPreference = typeof schema.notificationPreferences.$inferSelect;

function ownerCondition(owner: OwnerRef) {
  return owner.ownerType === 'user'
    ? and(
        eq(schema.notificationPreferences.ownerType, 'user'),
        eq(schema.notificationPreferences.ownerUserId, owner.ownerUserId),
      )
    : and(
        eq(schema.notificationPreferences.ownerType, 'contact'),
        eq(schema.notificationPreferences.ownerContactId, owner.ownerContactId),
      );
}

export async function findPreferencesForOwner(
  tx: DatabaseClient,
  organizationId: string,
  owner: OwnerRef,
): Promise<NotificationPreference[]> {
  return tx
    .select()
    .from(schema.notificationPreferences)
    .where(and(eq(schema.notificationPreferences.organizationId, organizationId), ownerCondition(owner)));
}

/**
 * Absence of a row for a given (owner, eventType, channel) means enabled
 * — notifications-prd.md's opt-out model, mirrored by the column's own
 * `default(true)`. Used by `@atlas/notifications`'s `sendNotification` to
 * decide whether to attempt delivery at all.
 */
export async function isChannelEnabled(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    owner: OwnerRef;
    eventType: NotificationEventType;
    channel: NotificationChannel;
  },
): Promise<boolean> {
  const [row] = await tx
    .select({ enabled: schema.notificationPreferences.enabled })
    .from(schema.notificationPreferences)
    .where(
      and(
        eq(schema.notificationPreferences.organizationId, params.organizationId),
        ownerCondition(params.owner),
        eq(schema.notificationPreferences.eventType, params.eventType),
        eq(schema.notificationPreferences.channel, params.channel),
      ),
    )
    .limit(1);
  return row ? row.enabled : true;
}

export interface UpsertPreferenceInput {
  organizationId: string;
  owner: OwnerRef;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
}

/**
 * Insert-or-update by the same (owner, event_type, channel) key the
 * table's two partial unique indexes enforce
 * (`uq_notification_preferences_{user,contact}` — migration 0027).
 * Drizzle's `onConflictDoUpdate` needs one concrete target per owner
 * type since a partial unique index can't be referenced generically.
 */
export async function upsertPreference(
  tx: DatabaseClient,
  input: UpsertPreferenceInput,
): Promise<NotificationPreference> {
  const values =
    input.owner.ownerType === 'user'
      ? {
          organizationId: input.organizationId,
          ownerType: 'user' as const,
          ownerUserId: input.owner.ownerUserId,
          eventType: input.eventType,
          channel: input.channel,
          enabled: input.enabled,
        }
      : {
          organizationId: input.organizationId,
          ownerType: 'contact' as const,
          ownerContactId: input.owner.ownerContactId,
          eventType: input.eventType,
          channel: input.channel,
          enabled: input.enabled,
        };

  // Each partial unique index (migration 0027) needs its own matching
  // `targetWhere` predicate — Postgres won't pick an arbiter index for
  // ON CONFLICT (columns) without it, per drizzle-orm's
  // `onConflictDoUpdate` docs.
  const target =
    input.owner.ownerType === 'user'
      ? [
          schema.notificationPreferences.ownerUserId,
          schema.notificationPreferences.eventType,
          schema.notificationPreferences.channel,
        ]
      : [
          schema.notificationPreferences.ownerContactId,
          schema.notificationPreferences.eventType,
          schema.notificationPreferences.channel,
        ];
  const targetWhere =
    input.owner.ownerType === 'user'
      ? sql`${schema.notificationPreferences.ownerType} = 'user'`
      : sql`${schema.notificationPreferences.ownerType} = 'contact'`;

  const [row] = await tx
    .insert(schema.notificationPreferences)
    .values(values)
    .onConflictDoUpdate({
      target,
      targetWhere,
      set: { enabled: input.enabled, updatedAt: new Date() },
    })
    .returning();
  if (!row) throw new Error('Failed to upsert notification preference.');
  return row;
}
