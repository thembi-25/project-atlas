import { listPayments } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializePayment } from '@/lib/financials-serializers';

/**
 * GET /api/v1/payments — payments.md, "API requirements." Added Sprint 7
 * (`@atlas/financials`'s `listPayments`) — Payments were previously only
 * ever listed per-Invoice; this organization-wide list is what the CSV
 * export route (reporting-prd.md §7) needs to exist at all. Filterable:
 * `status`, `invoice_id`.
 */
const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;

export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const limit = parseLimit(url.searchParams.get('limit'));
  const statusParam = url.searchParams.get('status');
  const status = statusParam
    ? (PAYMENT_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof PAYMENT_STATUSES)[number])
      : (() => {
          throw new AppError('validation_error', `Unsupported status: ${statusParam}`, [
            { field: 'status', issue: `Must be one of: ${PAYMENT_STATUSES.join(', ')}` },
          ]);
        })()
    : undefined;
  const invoiceId = url.searchParams.get('invoice_id') ?? undefined;
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listPayments(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    status,
    invoiceId,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ sortValue: last.createdAt.toISOString(), id: last.id }) : null;

  return {
    data: rows.map(serializePayment),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});
