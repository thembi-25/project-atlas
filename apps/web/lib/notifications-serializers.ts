import type { NotificationPreference, NotificationRecord } from '@atlas/notifications';

/** docs/05-api/resource-conventions.md: response JSON mirrors database column names (snake_case). */
export function serializeNotificationPreference(pref: NotificationPreference) {
  return {
    id: pref.id,
    organization_id: pref.organizationId,
    owner_type: pref.ownerType,
    owner_user_id: pref.ownerUserId,
    owner_contact_id: pref.ownerContactId,
    event_type: pref.eventType,
    channel: pref.channel,
    enabled: pref.enabled,
    created_at: pref.createdAt.toISOString(),
    updated_at: pref.updatedAt.toISOString(),
  };
}

export function serializeNotification(notification: NotificationRecord) {
  return {
    id: notification.id,
    organization_id: notification.organizationId,
    recipient_type: notification.recipientType,
    recipient_user_id: notification.recipientUserId,
    recipient_contact_id: notification.recipientContactId,
    event_type: notification.eventType,
    channel: notification.channel,
    status: notification.status,
    subject: notification.subject,
    body: notification.body,
    provider_message_id: notification.providerMessageId,
    error_detail: notification.errorDetail,
    sent_at: notification.sentAt ? notification.sentAt.toISOString() : null,
    delivered_at: notification.deliveredAt ? notification.deliveredAt.toISOString() : null,
    created_at: notification.createdAt.toISOString(),
  };
}
