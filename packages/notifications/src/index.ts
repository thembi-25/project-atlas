/**
 * Notifications domain module for Project Atlas — Sprint 7 (Core
 * Operations MVP Hardening). See docs/06-modules/notifications-prd.md,
 * docs/13-roadmap/sprint-7.md.
 */

// Domain
export {
  NOTIFICATION_EVENT_TYPES,
  isNotificationEventType,
  NOTIFICATION_CHANNELS,
  isNotificationChannel,
  type NotificationEventType,
  type NotificationChannel,
} from './domain/event-catalog';
export { renderNotificationContent, type NotificationEvent, type RenderedNotification } from './domain/templates';
export { NotFoundError, ForbiddenError } from './domain/errors';

// Infrastructure (read-only types useful to route handlers building responses)
export type { NotificationPreference } from './infrastructure/preferences';
export type { NotificationRecord } from './infrastructure/notifications-log';
export type { OwnerRef } from './infrastructure/owner-ref';

// Application use cases
export { resolveOwnerRef, requireNotificationsAdminAccess } from './application/authorize';
export {
  listNotificationPreferences,
  updateNotificationPreference,
} from './application/preferences';
export type {
  ListNotificationPreferencesParams,
  UpdateNotificationPreferenceParams,
} from './application/preferences';
export { resolveRecipientAddress, type NotificationRecipient } from './application/resolve-recipient';
export { sendNotification, type SendNotificationParams, type SendNotificationResult } from './application/send-notification';
export { listMyNotifications, listOrganizationNotifications } from './application/list-notifications';
export type {
  ListMyNotificationsParams,
  ListOrganizationNotificationsParams,
} from './application/list-notifications';
