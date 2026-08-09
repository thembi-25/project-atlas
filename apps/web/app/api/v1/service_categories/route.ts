import { listServiceCategories } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeServiceCategory } from '@/lib/jobs-serializers';

/** GET /api/v1/service_categories — read-only catalog (platform defaults + Organization extensions). */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const categories = await listServiceCategories(getDb(), {
    organizationId,
    actorUserId: actor.id,
  });
  return { data: categories.map(serializeServiceCategory) };
});
