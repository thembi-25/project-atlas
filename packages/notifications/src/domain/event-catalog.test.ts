import { describe, expect, it } from 'vitest';
import { isNotificationChannel, isNotificationEventType, NOTIFICATION_EVENT_TYPES } from './event-catalog';

describe('isNotificationEventType', () => {
  it('accepts every launch-scope event type', () => {
    for (const type of NOTIFICATION_EVENT_TYPES) {
      expect(isNotificationEventType(type)).toBe(true);
    }
  });

  it('rejects an unknown event type', () => {
    expect(isNotificationEventType('job.deleted')).toBe(false);
  });
});

describe('isNotificationChannel', () => {
  it('accepts email and sms', () => {
    expect(isNotificationChannel('email')).toBe(true);
    expect(isNotificationChannel('sms')).toBe(true);
  });

  it('rejects an unknown channel', () => {
    expect(isNotificationChannel('push')).toBe(false);
  });
});
