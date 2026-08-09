import { listJobTypes } from '@atlas/jobs';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeJobType } from '@/lib/jobs-serializers';

/** GET /api/v1/job_types — read-only catalog (platform defaults + Organization extensions). */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const jobTypes = await listJobTypes(getDb(), { organizationId, actorUserId: actor.id });
  return { data: jobTypes.map(serializeJobType) };
});
