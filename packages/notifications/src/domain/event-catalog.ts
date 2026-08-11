/**
 * The launch-scope domain-event catalog this module consumes — see
 * docs/02-architecture/event-driven-architecture.md#event-catalog-launch-scope,
 * docs/13-roadmap/sprint-7.md. `NOTIFICATION_EVENT_TYPES` is the
 * authoritative list used both for API-layer validation (a preference's
 * `eventType` must be one of these) and by the Worker to know which
 * domain events have a Notifications consumer at all.
 */
export const NOTIFICATION_EVENT_TYPES = [
  'job.dispatched',
  'job.completed',
  'estimate.approved',
  'invoice.finalized',
  'payment.received',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export function isNotificationEventType(value: string): value is NotificationEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

export const NOTIFICATION_CHANNELS = ['email', 'sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export function isNotificationChannel(value: string): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}
