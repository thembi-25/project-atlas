import { listSchedule } from '@atlas/scheduling';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeScheduleEvent } from '@/lib/scheduling-serializers';

/** GET /api/v1/schedule?start=...&end=...&team_id=... — scheduling-prd.md §11: the board/calendar read. */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  if (!startParam || !endParam) {
    throw new AppError('bad_request', 'start and end query parameters are required.');
  }
  const start = new Date(startParam);
  const end = new Date(endParam);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('bad_request', 'start and end must be valid ISO 8601 timestamps.');
  }

  const events = await listSchedule(getDb(), {
    organizationId,
    actorUserId: actor.id,
    start,
    end,
    teamId: url.searchParams.get('team_id') ?? undefined,
  });

  return {
    data: events.map(serializeScheduleEvent),
    meta: { next_cursor: null, has_more: false },
  };
});
