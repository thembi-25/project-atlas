import { z } from 'zod';
import {
  createInventoryItem,
  listInventoryItems,
  type InventoryItemSortField,
  type SortDirection,
} from '@atlas/inventory';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import { serializeInventoryItem } from '@/lib/inventory-serializers';

/** GET /api/v1/inventory-items — inventory-prd.md §11. Sortable: `created_at` (default), `sku`. */
const SORTABLE_FIELDS: Record<string, InventoryItemSortField> = {
  created_at: 'created_at',
  sku: 'sku',
};

function parseSort(raw: string | null): {
  field: InventoryItemSortField;
  direction: SortDirection;
} {
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
  const { field, direction } = parseSort(url.searchParams.get('sort'));
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listInventoryItems(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    sortField: field,
    sortDirection: direction,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortValue: field === 'created_at' ? last.createdAt.toISOString() : last.sku,
          id: last.id,
        })
      : null;

  return {
    data: rows.map(serializeInventoryItem),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});

/** POST /api/v1/inventory-items — inventory-prd.md §11. */
const createInventoryItemSchema = z.object({
  organization_id: z.string().uuid(),
  sku: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  asset_type_id: z.string().uuid().optional(),
  unit_cost: z.number().nonnegative(),
  default_sell_price: z.number().nonnegative().optional(),
  low_stock_threshold: z.number().nonnegative().optional(),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createInventoryItemSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid Inventory Item payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const item = await createInventoryItem(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    sku: parsed.data.sku,
    description: parsed.data.description,
    assetTypeId: parsed.data.asset_type_id,
    unitCost: String(parsed.data.unit_cost),
    defaultSellPrice:
      parsed.data.default_sell_price !== undefined
        ? String(parsed.data.default_sell_price)
        : undefined,
    lowStockThreshold:
      parsed.data.low_stock_threshold !== undefined
        ? String(parsed.data.low_stock_threshold)
        : undefined,
  });

  return { data: serializeInventoryItem(item), status: 201 };
});
