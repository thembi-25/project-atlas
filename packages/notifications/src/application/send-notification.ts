import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { sendEmail, sendSms } from '@atlas/integrations';
import type { NotificationChannel } from '../domain/event-catalog';
import { renderNotificationContent, type NotificationEvent } from '../domain/templates';
import { isChannelEnabled } from '../infrastructure/preferences';
import {
  insertQueuedNotification,
  markNotificationFailed,
  markNotificationSent,
  type NotificationRecord,
} from '../infrastructure/notifications-log';
import { resolveRecipientAddress, type NotificationRecipient } from './resolve-recipient';

export interface SendNotificationParams {
  organizationId: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
}

export type SendNotificationResult =
  | { outcome: 'skipped'; reason: 'preference_disabled' | 'no_address' }
  | { outcome: 'sent'; notification: NotificationRecord }
  | { outcome: 'failed'; notification: NotificationRecord; error: string };

/**
 * The single entry point every Worker event consumer calls per
 * (event, recipient, channel) — notifications-prd.md §7/§8/§17. Runs
 * under `withServiceContext` since the Worker has no authenticated
 * request to scope RLS to; the `notifications`/`notification_preferences`
 * tables' RLS policies (migration 0028) grant no INSERT to `authenticated`
 * on `notifications` at all, so this is the only write path by design,
 * not a convenience shortcut. A provider failure is caught and recorded
 * as `failed`, never rethrown — notifications-prd.md business rule:
 * "Notification delivery failure never blocks the underlying business
 * operation." No automated retry loop is implemented in this sprint (see
 * docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md, Known Limitations) —
 * the first attempt's outcome is the recorded outcome.
 */
export async function sendNotification(
  db: DatabaseClient,
  params: SendNotificationParams,
): Promise<SendNotificationResult> {
  return withServiceContext(db, async (tx) => {
    const owner =
      params.recipient.type === 'user'
        ? ({ ownerType: 'user' as const, ownerUserId: params.recipient.userId })
        : ({ ownerType: 'contact' as const, ownerContactId: params.recipient.contactId });

    const enabled = await isChannelEnabled(tx, {
      organizationId: params.organizationId,
      owner,
      eventType: params.event.type,
      channel: params.channel,
    });
    if (!enabled) {
      return { outcome: 'skipped', reason: 'preference_disabled' };
    }

    const resolved = await resolveRecipientAddress(tx, params.recipient, params.channel);
    if (!resolved) {
      return { outcome: 'skipped', reason: 'no_address' };
    }

    const content = renderNotificationContent(params.event, resolved.channel);

    const queued = await insertQueuedNotification(tx, {
      organizationId: params.organizationId,
      recipientType: params.recipient.type,
      recipientUserId: params.recipient.type === 'user' ? params.recipient.userId : undefined,
      recipientContactId: params.recipient.type === 'contact' ? params.recipient.contactId : undefined,
      eventType: params.event.type,
      channel: resolved.channel,
      subject: content.subject,
      body: content.body,
    });

    try {
      const providerResult =
        resolved.channel === 'email'
          ? await sendEmail({ to: resolved.address, subject: content.subject ?? '', html: content.body })
          : await sendSms({ to: resolved.address, body: content.body });

      const sent = await markNotificationSent(tx, queued.id, {
        providerMessageId: providerResult.providerMessageId,
        sentAt: new Date(),
      });
      return { outcome: 'sent', notification: sent };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = await markNotificationFailed(tx, queued.id, message);
      return { outcome: 'failed', notification: failed, error: message };
    }
  });
}
