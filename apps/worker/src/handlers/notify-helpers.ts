import type { DatabaseClient } from '@atlas/database';
import { sendNotification, type NotificationEvent, type NotificationRecipient } from '@atlas/notifications';
import { logger } from '../logger';

/**
 * notifications-prd.md's acceptance criterion ("Customer with SMS
 * disabled and email enabled ... email is sent and no SMS is attempted")
 * implies both channels are independently attempted by default —
 * event-driven-architecture.md's catalog phrases every Notifications
 * consumer as "SMS/email," not "SMS or email." Each channel's own
 * preference/address-resolution in `sendNotification` decides whether
 * that particular send actually goes out; a failure on one channel never
 * blocks the other (each call is independent).
 */
export async function notifyBothChannels(
  db: DatabaseClient,
  params: { organizationId: string; event: NotificationEvent; recipient: NotificationRecipient },
): Promise<void> {
  for (const channel of ['email', 'sms'] as const) {
    const result = await sendNotification(db, { ...params, channel });
    if (result.outcome === 'failed') {
      logger.warn(`${params.event.type}: notification send failed`, {
        organizationId: params.organizationId,
        channel,
        recipient: params.recipient,
        error: result.error,
      });
    }
  }
}
