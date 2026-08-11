import { disconnectQuickBooks } from '@atlas/quickbooks';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeIntegrationConnection } from '@/lib/quickbooks-serializers';

/** DELETE /api/v1/integrations/quickbooks — integrations-prd.md §11. Admin/Owner-only (enforced in @atlas/quickbooks). */
export const DELETE = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }

  const connection = await disconnectQuickBooks(getDb(), { organizationId, actorUserId: actor.id });

  return { data: serializeIntegrationConnection(connection) };
});
