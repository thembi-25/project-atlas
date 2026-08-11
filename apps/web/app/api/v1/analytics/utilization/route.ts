import { getTechnicianUtilization } from '@atlas/analytics';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeStaleness, serializeTechnicianUtilizationRow } from '@/lib/analytics-serializers';

/** GET /api/v1/analytics/utilization — analytics-prd.md §11. `scope` in the response `meta` reflects what the actor's Role actually resolved to (`organization` or `team`), not a client-requested value — analytics-prd.md §16: "Role-inappropriate scope returns 403" is handled by @atlas/analytics itself, not a client-supplied override here. */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }

  const result = await getTechnicianUtilization(getDb(), { organizationId, actorUserId: actor.id });

  return {
    data: result.rows.map(serializeTechnicianUtilizationRow),
    meta: { ...serializeStaleness(result), scope: result.scope },
  };
});
