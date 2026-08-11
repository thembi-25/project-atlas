import type { DatabaseClient } from '@atlas/database';
import { findUserById } from '@atlas/identity';
import { findContactById } from '@atlas/crm';
import type { NotificationChannel } from '../domain/event-catalog';

export type NotificationRecipient =
  | { type: 'user'; userId: string }
  | { type: 'contact'; contactId: string };

export interface ResolvedAddress {
  channel: NotificationChannel;
  address: string;
}

/**
 * notifications-prd.md, "Edge cases": "A phone number is invalid/
 * unreachable — the system falls back to the recipient's email channel
 * if one is on file and the event supports it." Simplified to: if the
 * requested channel is SMS and no phone is on file, fall back to email;
 * every launch-scope event supports email, so there is no per-event
 * channel restriction to check. Returns `null` when no deliverable
 * address exists at all (e.g. a Contact with neither phone nor email on
 * file) — the caller (`sendNotification`) treats that as a skip, not an
 * error, mirroring the disabled-preference skip path.
 */
export async function resolveRecipientAddress(
  tx: DatabaseClient,
  recipient: NotificationRecipient,
  channel: NotificationChannel,
): Promise<ResolvedAddress | null> {
  if (recipient.type === 'user') {
    const user = await findUserById(tx, recipient.userId);
    if (!user) return null;
    if (channel === 'sms' && user.phone) {
      return { channel: 'sms', address: user.phone };
    }
    return { channel: 'email', address: user.email };
  }

  const contact = await findContactById(tx, recipient.contactId);
  if (!contact) return null;
  if (channel === 'sms' && contact.phone) {
    return { channel: 'sms', address: contact.phone };
  }
  if (contact.email) {
    return { channel: 'email', address: contact.email };
  }
  return null;
}
