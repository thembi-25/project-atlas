import { getAssetHistory } from '@atlas/assets';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeAsset } from '@/lib/assets-serializers';

/**
 * GET /api/v1/assets/{id}/history — assets-prd.md §11: all Jobs
 * referencing the Asset, ordered by date. `jobs` is always `[]` this
 * sprint — see docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Known
 * Limitations."
 */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const history = await getAssetHistory(getDb(), {
    organizationId,
    actorUserId: actor.id,
    assetId: context.params.id,
  });
  return { data: { asset: serializeAsset(history.asset), jobs: history.jobs } };
});
