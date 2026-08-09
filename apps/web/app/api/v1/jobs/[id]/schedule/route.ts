import { z } from 'zod';
import { getJobSchedule, rescheduleJob, scheduleJob } from '@atlas/scheduling';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeScheduleConflict, serializeScheduleEvent } from '@/lib/scheduling-serializers';

export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const event = await getJobSchedule(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobId: context.params.id,
  });
  if (!event) {
    throw new AppError('not_found', 'Schedule Event not found.');
  }
  return { data: serializeScheduleEvent(event) };
});

/** POST /api/v1/jobs/{id}/schedule — scheduling-prd.md §11: creates the Job's first Schedule Event and transitions `draft` -> `scheduled`. */
const scheduleSchema = z.object({
  organization_id: z.string().uuid(),
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime(),
  user_ids: z.array(z.string().uuid()).min(1),
  team_id: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = scheduleSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid schedule payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const result = await scheduleJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      scheduledStart: new Date(parsed.data.scheduled_start),
      scheduledEnd: new Date(parsed.data.scheduled_end),
      userIds: parsed.data.user_ids,
      teamId: parsed.data.team_id,
      notes: parsed.data.notes,
    });
    return {
      data: {
        schedule_event: serializeScheduleEvent(result.scheduleEvent),
        conflicts: result.conflicts.map(serializeScheduleConflict),
      },
      status: 201,
    };
  },
);

/** PATCH /api/v1/jobs/{id}/schedule — scheduling-prd.md §11: reschedule, requires `reason` on a `dispatched`+ Job. */
const rescheduleSchema = z.object({
  organization_id: z.string().uuid(),
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime(),
  user_ids: z.array(z.string().uuid()).optional(),
  team_id: z.string().uuid().nullable().optional(),
  reason: z.string().max(2000).optional(),
});

export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = rescheduleSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid reschedule payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const result = await rescheduleJob(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      jobId: context.params.id,
      scheduledStart: new Date(parsed.data.scheduled_start),
      scheduledEnd: new Date(parsed.data.scheduled_end),
      userIds: parsed.data.user_ids,
      teamId: parsed.data.team_id,
      reason: parsed.data.reason,
    });
    return {
      data: {
        schedule_event: serializeScheduleEvent(result.scheduleEvent),
        conflicts: result.conflicts.map(serializeScheduleConflict),
      },
    };
  },
);
