import { z } from 'zod';
import { createPurchaseOrder, listPurchaseOrders, PURCHASE_ORDER_STATUSES } from '@atlas/suppliers';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { decodeCursor, encodeCursor, parseLimit } from '@/lib/cursor';
import {
  serializePurchaseOrder,
  serializePurchaseOrderLineItem,
} from '@/lib/inventory-serializers';

/** GET /api/v1/purchase-orders — suppliers-prd.md §11. Sorted by `created_at` only (no secondary sort field documented). Filterable: `status`. */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const limit = parseLimit(url.searchParams.get('limit'));
  const sortParam = url.searchParams.get('sort');
  const sortDirection: 'asc' | 'desc' = sortParam === 'created_at' ? 'asc' : 'desc';
  const statusParam = url.searchParams.get('status');
  const status = statusParam
    ? (PURCHASE_ORDER_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof PURCHASE_ORDER_STATUSES)[number])
      : (() => {
          throw new AppError('validation_error', 'Invalid status filter.', [
            { field: 'status', issue: `Must be one of: ${PURCHASE_ORDER_STATUSES.join(', ')}` },
          ]);
        })()
    : undefined;
  const cursorParam = url.searchParams.get('cursor');

  const { rows, hasMore } = await listPurchaseOrders(getDb(), {
    organizationId,
    actorUserId: actor.id,
    limit,
    cursor: cursorParam ? decodeCursor(cursorParam) : undefined,
    sortDirection,
    status,
  });

  const last = rows.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ sortValue: last.createdAt.toISOString(), id: last.id }) : null;

  return {
    data: rows.map(serializePurchaseOrder),
    meta: { next_cursor: nextCursor, has_more: hasMore },
  };
});

/** POST /api/v1/purchase-orders — suppliers-prd.md §7: "basic Purchase Order creation (line items, status, received date) referencing Inventory Items." */
const lineItemSchema = z.object({
  inventory_item_id: z.string().uuid(),
  quantity_ordered: z.number().positive(),
  unit_cost: z.number().nonnegative(),
});

const createSchema = z.object({
  organization_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  receiving_location_id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  line_items: z.array(lineItemSchema).min(1),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid Purchase Order payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }
  const result = await createPurchaseOrder(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    supplierId: parsed.data.supplier_id,
    receivingLocationId: parsed.data.receiving_location_id,
    notes: parsed.data.notes,
    lineItems: parsed.data.line_items.map((line) => ({
      inventoryItemId: line.inventory_item_id,
      quantityOrdered: String(line.quantity_ordered),
      unitCost: String(line.unit_cost),
    })),
  });
  return {
    data: {
      purchase_order: serializePurchaseOrder(result.purchaseOrder),
      line_items: result.lineItems.map(serializePurchaseOrderLineItem),
    },
    status: 201,
  };
});
