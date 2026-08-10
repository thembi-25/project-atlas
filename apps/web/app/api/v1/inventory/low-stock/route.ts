import { listLowStockItems } from '@atlas/inventory';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeLowStockRow } from '@/lib/inventory-serializers';

/** GET /api/v1/inventory/low-stock — inventory-prd.md §13: "low-stock dashboard widget." Notification delivery is out of scope this sprint (see docs/13-roadmap/sprint-6.md, "Scope decisions"); this is the read-only computed view. */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const rows = await listLowStockItems(getDb(), { organizationId, actorUserId: actor.id });
  return { data: rows.map(serializeLowStockRow) };
});
