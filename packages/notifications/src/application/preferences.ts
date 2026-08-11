import { withRequestContext, type DatabaseClient } from '@atlas/database';
import type { NotificationChannel, NotificationEventType } from '../domain/event-catalog';
import { findPreferencesForOwner, upsertPreference, type NotificationPreference } from '../infrastructure/preferences';
import { resolveOwnerRef } from './authorize';

export interface ListNotificationPreferencesParams {
  organizationId: string;
  actorUserId: string;
}

/** notifications-prd.md §13: "Notification preference settings page." */
export async function listNotificationPreferences(
  db: DatabaseClient,
  params: ListNotificationPreferencesParams,
): Promise<NotificationPreference[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const owner = await resolveOwnerRef(tx, params);
    return findPreferencesForOwner(tx, params.organizationId, owner);
  });
}

export interface UpdateNotificationPreferenceParams {
  organizationId: string;
  actorUserId: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
}

/**
 * notifications-prd.md, "Edge cases": "disabling notifications never
 * disables the underlying business action" — this only ever touches
 * `notification_preferences`, never any other module's data.
 */
export async function updateNotificationPreference(
  db: DatabaseClient,
  params: UpdateNotificationPreferenceParams,
): Promise<NotificationPreference> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    const owner = await resolveOwnerRef(tx, params);
    return upsertPreference(tx, {
      organizationId: params.organizationId,
      owner,
      eventType: params.eventType,
      channel: params.channel,
      enabled: params.enabled,
    });
  });
}
