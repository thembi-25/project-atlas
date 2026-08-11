import { getJobVolumeByType } from '@atlas/analytics';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJobVolumeByTypeRow, serializeStaleness } from '@/lib/analytics-serializers';

/** GET /api/v1/analytics/job-volume — analytics-prd.md §11. */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }

  const result = await getJobVolumeByType(getDb(), { organizationId, actorUserId: actor.id });

  return {
    data: result.rows.map(serializeJobVolumeByTypeRow),
    meta: serializeStaleness(result),
  };
});
