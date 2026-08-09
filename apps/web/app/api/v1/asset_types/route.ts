import { listAssetTypes } from '@atlas/assets';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeAssetType } from '@/lib/assets-serializers';

/**
 * GET /api/v1/asset_types — read-only catalog (platform defaults plus
 * this Organization's own extensions) backing the Asset-creation form's
 * type picker. Not itemized in assets-prd.md §11's endpoint list, but
 * required to populate `asset_type_id`, which that same section's
 * `POST /api/v1/assets` depends on — see docs/13-roadmap/
 * SPRINT-3-COMPLETION-REPORT.md, "Deviations From Documentation."
 * Create/update of Asset Types is out of scope this sprint (assets.md:
 * "Organization-scoped, extensible from platform defaults" — the
 * extension mechanism itself is a Known Limitation).
 */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const assetTypes = await listAssetTypes(getDb(), {
    organizationId,
    actorUserId: actor.id,
  });
  return { data: assetTypes.map(serializeAssetType) };
});
