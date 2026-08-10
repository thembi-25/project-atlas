import { z } from 'zod';
import {
  createEstimate,
  listEstimates,
  type EstimateSortField,
  type SortDirection,
} from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeEstimate, serializeEstimateLineItem } from '@/lib/financials-serializers';

/** GET /api/v1/estimates — estimates.md, "API requirements". Sortable: `created_at` (default), `estimate_number`. Filterable: `status`, `job_id`, `customer_id`. */
const SORTABLE_FIELDS: Record<string, EstimateSortField> = {
  created_at: 'created_at',
  estimate_number: 'estimate_number',
};

const ESTIMATE_STATUSES = [
  'draft',
  'sent',
  'approved',
  'rejected',
  'expired',
  'converted',
  'cancelled',
] as const;

function parseSort(raw: string | null): { field: EstimateSortField; direction: SortDirection } {
  if (!raw) return { field: 'created_at', direction: 'desc' };
  const [first] = raw.split(',');
  const token = first ?? '-created_at';
  const direction: SortDirection = token.startsWith('-') ? 'desc' : 'asc';
  const fieldName = token.startsWith('-') ? token.slice(1) : token;
  const field = SORTABLE_FIELDS[fieldName];
  if (!field) {
    throw new AppError('validation_error', `Unsupported sort field: ${fieldName}`, [
      { field: 'sort', issue: `Must be one of: ${Object.keys(SORTABLE_FIELDS).join(', ')}` },
    ]);
  }
  return { field, direction };
}

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
    ? (ESTIMATE_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof ESTIMATE_STATUSES)[number])
      : (() => {
          throw new AppError('validation_error', 'Invalid status filter.', [
            { field: 'status', issue: `Must be one of: ${ESTIMATE_STATUSES.join(', ')}` },
          ]);
        })()
    : undefined;
  const jobId = url.searchParams.get('job_id') ?? undefined;
  const customerId = url.searchParams.get('customer_id') ?? undefined;
  const { field, direction } = parseSort(url.searchParams.get('sort'));
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listEstimates(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    sortField: field,
    sortDirection: direction,
    status,
    jobId,
    customerId,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortValue:
            field === 'created_at' ? last.createdAt.toISOString() : String(last.estimateNumber),
          id: last.id,
        })
      : null;

  return {
    data: rows.map(serializeEstimate),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});

/** POST /api/v1/estimates — estimates.md: create/update restricted to `draft`. */
const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const createEstimateSchema = z.object({
  organization_id: z.string().uuid(),
  job_id: z.string().uuid(),
  contact_id: z.string().uuid().optional(),
  valid_until: z.string().datetime().optional(),
  tax_total: z.number().nonnegative().optional(),
  line_items: z.array(lineItemSchema).min(1),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createEstimateSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid estimate payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const result = await createEstimate(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    jobId: parsed.data.job_id,
    contactId: parsed.data.contact_id,
    validUntil: parsed.data.valid_until ? new Date(parsed.data.valid_until) : undefined,
    taxTotal: parsed.data.tax_total,
    lineItems: parsed.data.line_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  });

  return {
    data: {
      estimate: serializeEstimate(result.estimate),
      line_items: result.lineItems.map(serializeEstimateLineItem),
    },
    status: 201,
  };
});
