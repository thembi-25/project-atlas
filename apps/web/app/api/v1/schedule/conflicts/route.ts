import { getConflicts } from '@atlas/scheduling';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeScheduleConflict } from '@/lib/scheduling-serializers';

/** GET /api/v1/schedule/conflicts?user_id=...&start=...&end=... — scheduling-prd.md §11. */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');
  const userIds = url.searchParams.getAll('user_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  if (!startParam || !endParam || userIds.length === 0) {
    throw new AppError(
      'bad_request',
      'start, end, and at least one user_id query parameter are required.',
    );
  }
  const start = new Date(startParam);
  const end = new Date(endParam);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('bad_request', 'start and end must be valid ISO 8601 timestamps.');
  }

  const conflicts = await getConflicts(getDb(), {
    organizationId,
    actorUserId: actor.id,
    userIds,
    start,
    end,
  });

  return { data: conflicts.map(serializeScheduleConflict) };
});
