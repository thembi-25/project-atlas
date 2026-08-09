import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type ScheduleEvent = typeof schema.scheduleEvents.$inferSelect;

export interface CreateScheduleEventInput {
  organizationId: string;
  jobId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  teamId?: string | undefined;
  notes?: string | undefined;
}

export async function insertScheduleEvent(
  tx: DatabaseClient,
  input: CreateScheduleEventInput,
): Promise<ScheduleEvent> {
  const [event] = await tx
    .insert(schema.scheduleEvents)
    .values({
      organizationId: input.organizationId,
      jobId: input.jobId,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      teamId: input.teamId ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (!event) {
    throw new Error('Failed to insert schedule event');
  }
  return event;
}

export async function findScheduleEventById(
  tx: DatabaseClient,
  scheduleEventId: string,
): Promise<ScheduleEvent | undefined> {
  const [event] = await tx
    .select()
    .from(schema.scheduleEvents)
    .where(eq(schema.scheduleEvents.id, scheduleEventId))
    .limit(1);
  return event;
}

/** scheduling.md: "a Job has at most one active `schedule_event`." */
export async function findScheduleEventByJobId(
  tx: DatabaseClient,
  jobId: string,
): Promise<ScheduleEvent | undefined> {
  const [event] = await tx
    .select()
    .from(schema.scheduleEvents)
    .where(eq(schema.scheduleEvents.jobId, jobId))
    .limit(1);
  return event;
}

export interface UpdateScheduleEventWindowInput {
  scheduledStart: Date;
  scheduledEnd: Date;
  teamId?: string | null | undefined;
  notes?: string | null | undefined;
}

/** scheduling.md business rule 1: "rescheduling updates it... rather than creating a competing record." */
export async function updateScheduleEventWindow(
  tx: DatabaseClient,
  scheduleEventId: string,
  input: UpdateScheduleEventWindowInput,
): Promise<ScheduleEvent | undefined> {
  const [event] = await tx
    .update(schema.scheduleEvents)
    .set({
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.scheduleEvents.id, scheduleEventId))
    .returning();
  return event;
}

export interface ListScheduleEventsParams {
  organizationId: string;
  start: Date;
  end: Date;
  teamId?: string | undefined;
  userId?: string | undefined;
}

/** The Scheduling board read — scheduling-prd.md §11: `GET /api/v1/schedule?start=...&end=...&team_id=...`. */
export async function listScheduleEventsForOrganization(
  tx: DatabaseClient,
  params: ListScheduleEventsParams,
): Promise<ScheduleEvent[]> {
  const conditions = [
    eq(schema.scheduleEvents.organizationId, params.organizationId),
    lte(schema.scheduleEvents.scheduledStart, params.end),
    gte(schema.scheduleEvents.scheduledEnd, params.start),
  ];
  if (params.teamId) conditions.push(eq(schema.scheduleEvents.teamId, params.teamId));
  if (params.userId) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM jobs.schedule_event_assignments sea WHERE sea.schedule_event_id = ${schema.scheduleEvents.id} AND sea.user_id = ${params.userId}::uuid)`,
    );
  }
  return tx
    .select()
    .from(schema.scheduleEvents)
    .where(and(...conditions))
    .orderBy(schema.scheduleEvents.scheduledStart);
}

export type ScheduleEventAssignment = typeof schema.scheduleEventAssignments.$inferSelect;

export async function insertScheduleEventAssignment(
  tx: DatabaseClient,
  input: { organizationId: string; scheduleEventId: string; userId: string },
): Promise<ScheduleEventAssignment> {
  const [assignment] = await tx
    .insert(schema.scheduleEventAssignments)
    .values({
      organizationId: input.organizationId,
      scheduleEventId: input.scheduleEventId,
      userId: input.userId,
    })
    .returning();
  if (!assignment) {
    throw new Error('Failed to insert schedule event assignment');
  }
  return assignment;
}

export async function deleteScheduleEventAssignmentsForEvent(
  tx: DatabaseClient,
  scheduleEventId: string,
): Promise<void> {
  await tx
    .delete(schema.scheduleEventAssignments)
    .where(eq(schema.scheduleEventAssignments.scheduleEventId, scheduleEventId));
}

export async function listScheduleEventAssignments(
  tx: DatabaseClient,
  scheduleEventId: string,
): Promise<ScheduleEventAssignment[]> {
  return tx
    .select()
    .from(schema.scheduleEventAssignments)
    .where(eq(schema.scheduleEventAssignments.scheduleEventId, scheduleEventId));
}

export type ScheduleEventHistoryEntry = typeof schema.scheduleEventHistory.$inferSelect;

export async function insertScheduleEventHistory(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    scheduleEventId: string;
    jobId: string;
    previousStart: Date;
    previousEnd: Date;
    reason?: string | undefined;
    changedByUserId?: string | undefined;
  },
): Promise<ScheduleEventHistoryEntry> {
  const [entry] = await tx
    .insert(schema.scheduleEventHistory)
    .values({
      organizationId: input.organizationId,
      scheduleEventId: input.scheduleEventId,
      jobId: input.jobId,
      previousStart: input.previousStart,
      previousEnd: input.previousEnd,
      reason: input.reason ?? null,
      changedByUserId: input.changedByUserId ?? null,
    })
    .returning();
  if (!entry) {
    throw new Error('Failed to insert schedule event history entry');
  }
  return entry;
}

export async function listScheduleEventHistory(
  tx: DatabaseClient,
  scheduleEventId: string,
): Promise<ScheduleEventHistoryEntry[]> {
  return tx
    .select()
    .from(schema.scheduleEventHistory)
    .where(eq(schema.scheduleEventHistory.scheduleEventId, scheduleEventId))
    .orderBy(schema.scheduleEventHistory.createdAt);
}

export interface ScheduleConflict {
  scheduleEventId: string;
  jobId: string;
  userId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

/**
 * scheduling.md business rule 2: overlap detection for a candidate
 * window, per Technician — uses the GiST-indexed `tstzrange` overlap
 * operator (`&&`) for the range half and a join to
 * `schedule_event_assignments` for the per-Technician half. `excludeScheduleEventId`
 * lets a reschedule check for conflicts without flagging the event's
 * own current (about-to-be-replaced) window against itself.
 */
export async function findSchedulingConflicts(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    userIds: string[];
    scheduledStart: Date;
    scheduledEnd: Date;
    excludeScheduleEventId?: string | undefined;
  },
): Promise<ScheduleConflict[]> {
  if (params.userIds.length === 0) return [];
  const rows = await tx.execute<{
    schedule_event_id: string;
    job_id: string;
    user_id: string;
    scheduled_start: Date;
    scheduled_end: Date;
  }>(sql`
    SELECT se.id AS schedule_event_id, se.job_id, sea.user_id, se.scheduled_start, se.scheduled_end
    FROM jobs.schedule_events se
    JOIN jobs.schedule_event_assignments sea ON sea.schedule_event_id = se.id
    WHERE se.organization_id = ${params.organizationId}::uuid
      AND sea.user_id = ANY(${params.userIds}::uuid[])
      AND tstzrange(se.scheduled_start, se.scheduled_end, '[)') && tstzrange(${params.scheduledStart}::timestamptz, ${params.scheduledEnd}::timestamptz, '[)')
      AND (${params.excludeScheduleEventId ?? null}::uuid IS NULL OR se.id != ${params.excludeScheduleEventId ?? null}::uuid)
  `);
  return rows.map((row) => ({
    scheduleEventId: row.schedule_event_id,
    jobId: row.job_id,
    userId: row.user_id,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
  }));
}
