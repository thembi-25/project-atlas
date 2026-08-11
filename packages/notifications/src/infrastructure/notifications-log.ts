import { and, desc, eq, or, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { NotificationChannel, NotificationEventType } from '../domain/event-catalog';

export type NotificationRecord = typeof schema.notifications.$inferSelect;

export interface InsertQueuedNotificationInput {
  organizationId: string;
  recipientType: 'user' | 'contact';
  recipientUserId?: string | undefined;
  recipientContactId?: string | undefined;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  subject?: string | undefined;
  body: string;
}

export async function insertQueuedNotification(
  tx: DatabaseClient,
  input: InsertQueuedNotificationInput,
): Promise<NotificationRecord> {
  const [row] = await tx
    .insert(schema.notifications)
    .values({
      organizationId: input.organizationId,
      recipientType: input.recipientType,
      recipientUserId: input.recipientUserId ?? null,
      recipientContactId: input.recipientContactId ?? null,
      eventType: input.eventType,
      channel: input.channel,
      status: 'queued',
      subject: input.subject ?? null,
      body: input.body,
    })
    .returning();
  if (!row) throw new Error('Failed to queue notification.');
  return row;
}

export async function markNotificationSent(
  tx: DatabaseClient,
  id: string,
  fields: { providerMessageId: string; sentAt: Date },
): Promise<NotificationRecord> {
  const [row] = await tx
    .update(schema.notifications)
    .set({ status: 'sent', providerMessageId: fields.providerMessageId, sentAt: fields.sentAt })
    .where(eq(schema.notifications.id, id))
    .returning();
  if (!row) throw new Error('Failed to update notification.');
  return row;
}

export async function markNotificationFailed(
  tx: DatabaseClient,
  id: string,
  errorDetail: string,
): Promise<NotificationRecord> {
  const [row] = await tx
    .update(schema.notifications)
    .set({ status: 'failed', errorDetail })
    .where(eq(schema.notifications.id, id))
    .returning();
  if (!row) throw new Error('Failed to update notification.');
  return row;
}

function cursorCondition(cursor: { sortValue: string; id: string } | undefined) {
  if (!cursor) return undefined;
  return sql`(${schema.notifications.createdAt}, ${schema.notifications.id}) < (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
}

export interface ListNotificationsResult {
  rows: NotificationRecord[];
  hasMore: boolean;
}

/** Staff/Portal Contact self-view — notifications-prd.md §11 "in-app notification center." */
export async function listNotificationsForRecipient(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    recipient: { type: 'user'; userId: string } | { type: 'contact'; contactId: string };
    limit: number;
    cursor?: { sortValue: string; id: string } | undefined;
  },
): Promise<ListNotificationsResult> {
  const recipientCondition =
    params.recipient.type === 'user'
      ? eq(schema.notifications.recipientUserId, params.recipient.userId)
      : eq(schema.notifications.recipientContactId, params.recipient.contactId);

  const conditions = [eq(schema.notifications.organizationId, params.organizationId), recipientCondition];
  const cursorCond = cursorCondition(params.cursor);
  if (cursorCond) conditions.push(cursorCond);

  const rows = await tx
    .select()
    .from(schema.notifications)
    .where(and(...conditions))
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id))
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}

/** Admin/Owner org-wide delivery-failure visibility — notifications-prd.md §12. */
export async function listNotificationsForOrganization(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    limit: number;
    cursor?: { sortValue: string; id: string } | undefined;
    failedOnly?: boolean | undefined;
  },
): Promise<ListNotificationsResult> {
  const conditions = [eq(schema.notifications.organizationId, params.organizationId)];
  if (params.failedOnly) {
    conditions.push(or(eq(schema.notifications.status, 'failed'), eq(schema.notifications.status, 'bounced'))!);
  }
  const cursorCond = cursorCondition(params.cursor);
  if (cursorCond) conditions.push(cursorCond);

  const rows = await tx
    .select()
    .from(schema.notifications)
    .where(and(...conditions))
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id))
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}
