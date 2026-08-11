import { getQuickBooksSyncStatus } from '@atlas/quickbooks';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeIntegrationConnection, serializeSyncRecord } from '@/lib/quickbooks-serializers';

/** GET /api/v1/integrations/quickbooks/sync-status — integrations-prd.md §11/§13. Admin/Owner-only (enforced in @atlas/quickbooks). */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const limit = parseLimit(url.searchParams.get('limit'));
  const cursorParam = url.searchParams.get('cursor');

  const { connection, syncRecords } = await getQuickBooksSyncStatus(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
  });

  const last = syncRecords.rows.at(-1);
  const nextCursor =
    syncRecords.hasMore && last
      ? encodeCursor({ sortValue: last.createdAt.toISOString(), id: last.id })
      : null;

  return {
    data: {
      connection: connection ? serializeIntegrationConnection(connection) : null,
      sync_records: syncRecords.rows.map(serializeSyncRecord),
    },
    meta: { next_cursor: nextCursor, has_more: syncRecords.hasMore },
  };
});
