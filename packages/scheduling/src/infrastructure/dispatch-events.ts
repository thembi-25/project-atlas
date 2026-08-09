import { desc, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type DispatchEvent = typeof schema.dispatchEvents.$inferSelect;

export async function insertDispatchEvent(
  tx: DatabaseClient,
  input: { organizationId: string; jobId: string; dispatchedByUserId?: string | undefined },
): Promise<DispatchEvent> {
  const [event] = await tx
    .insert(schema.dispatchEvents)
    .values({
      organizationId: input.organizationId,
      jobId: input.jobId,
      dispatchedByUserId: input.dispatchedByUserId ?? null,
    })
    .returning();
  if (!event) {
    throw new Error('Failed to insert dispatch event');
  }
  return event;
}

/** dispatch.md: "a forward-only sequence of optional timestamps" — the current dispatch is the most recent row (a Job may be re-dispatched after a reschedule supersedes an unacknowledged one). */
export async function findCurrentDispatchEventForJob(
  tx: DatabaseClient,
  jobId: string,
): Promise<DispatchEvent | undefined> {
  const [event] = await tx
    .select()
    .from(schema.dispatchEvents)
    .where(eq(schema.dispatchEvents.jobId, jobId))
    .orderBy(desc(schema.dispatchEvents.dispatchedAt))
    .limit(1);
  return event;
}

export async function listDispatchEventsForJob(
  tx: DatabaseClient,
  jobId: string,
): Promise<DispatchEvent[]> {
  return tx
    .select()
    .from(schema.dispatchEvents)
    .where(eq(schema.dispatchEvents.jobId, jobId))
    .orderBy(desc(schema.dispatchEvents.dispatchedAt));
}

export type DispatchTimestampField = 'acknowledgedAt' | 'enRouteAt' | 'arrivedAt';

export async function setDispatchTimestamp(
  tx: DatabaseClient,
  dispatchEventId: string,
  field: DispatchTimestampField,
): Promise<DispatchEvent | undefined> {
  const [event] = await tx
    .update(schema.dispatchEvents)
    .set({ [field]: new Date(), updatedAt: new Date() })
    .where(eq(schema.dispatchEvents.id, dispatchEventId))
    .returning();
  return event;
}
