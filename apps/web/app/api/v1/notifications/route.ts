import { listMyNotifications, listOrganizationNotifications } from '@atlas/notifications';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeNotification } from '@/lib/notifications-serializers';

/**
 * GET /api/v1/notifications — notifications-prd.md §11 "in-app
 * notification center." `scope=self` (default) is the requesting actor's
 * own notifications; `scope=organization` is the Admin/Owner-only
 * org-wide delivery-failure report (notifications-prd.md §12) — a
 * non-Admin/Owner requesting it gets `403`, not a silently filtered
 * empty list.
 */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const scope = url.searchParams.get('scope') === 'organization' ? 'organization' : 'self';
  const limit = parseLimit(url.searchParams.get('limit'));
  const cursorParam = url.searchParams.get('cursor');
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const { rows, hasMore } =
    scope === 'organization'
      ? await listOrganizationNotifications(getDb(), {
          organizationId,
          actorUserId: actor.id,
          limit,
          cursor,
          failedOnly: url.searchParams.get('failed_only') === 'true',
        })
      : await listMyNotifications(getDb(), { organizationId, actorUserId: actor.id, limit, cursor });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ sortValue: last.createdAt.toISOString(), id: last.id }) : null;

  return {
    data: rows.map(serializeNotification),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});
