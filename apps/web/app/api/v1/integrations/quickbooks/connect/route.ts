import { beginQuickBooksConnect } from '@atlas/quickbooks';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';

/** POST /api/v1/integrations/quickbooks/connect — integrations-prd.md §11. Admin/Owner-only (enforced in @atlas/quickbooks). Returns the Intuit-hosted authorization URL for the client to redirect the browser to. */
export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const organizationId =
    json && typeof json === 'object' && 'organization_id' in json ? (json as Record<string, unknown>).organization_id : undefined;
  if (typeof organizationId !== 'string') {
    throw new AppError('bad_request', 'organization_id is required.');
  }

  const { authorizationUrl } = await beginQuickBooksConnect(getDb(), {
    organizationId,
    actorUserId: actor.id,
  });

  return { data: { authorization_url: authorizationUrl } };
});
