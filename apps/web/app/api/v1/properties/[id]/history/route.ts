import { getPropertyHistory } from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeAssetHistoryEntry, serializeProperty } from '@/lib/properties-serializers';

/**
 * GET /api/v1/properties/{id}/history — properties-prd.md §11/§18: all
 * Assets (and, once Jobs exists, all Jobs) for a Property regardless of
 * which Customer association was active at the time. `jobs` is always
 * `[]` this sprint — see docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md,
 * "Known Limitations."
 */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const history = await getPropertyHistory(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyId: context.params.id,
  });
  return {
    data: {
      property: serializeProperty(history.property),
      assets: history.assets.map(serializeAssetHistoryEntry),
      jobs: history.jobs,
    },
  };
});
