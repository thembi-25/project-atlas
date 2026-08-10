import { z } from 'zod';
import { deleteInventoryItem, getInventoryItem, updateInventoryItem } from '@atlas/inventory';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeInventoryItem } from '@/lib/inventory-serializers';

/** GET /api/v1/inventory-items/{id} — inventory-prd.md §11. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const { item, quantityByLocation } = await getInventoryItem(getDb(), {
    organizationId,
    actorUserId: actor.id,
    inventoryItemId: context.params.id,
  });
  return {
    data: {
      ...serializeInventoryItem(item),
      quantity_by_location: quantityByLocation.map((q) => ({
        location_id: q.locationId,
        quantity_on_hand: q.quantityOnHand,
      })),
    },
  };
});

/** PATCH /api/v1/inventory-items/{id}. */
const updateSchema = z.object({
  organization_id: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  asset_type_id: z.string().uuid().nullable().optional(),
  unit_cost: z.number().nonnegative().optional(),
  default_sell_price: z.number().nonnegative().nullable().optional(),
  low_stock_threshold: z.number().nonnegative().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid Inventory Item payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const item = await updateInventoryItem(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      inventoryItemId: context.params.id,
      fields: {
        description: parsed.data.description,
        assetTypeId: parsed.data.asset_type_id,
        unitCost: parsed.data.unit_cost !== undefined ? String(parsed.data.unit_cost) : undefined,
        defaultSellPrice:
          parsed.data.default_sell_price !== undefined
            ? parsed.data.default_sell_price === null
              ? null
              : String(parsed.data.default_sell_price)
            : undefined,
        lowStockThreshold:
          parsed.data.low_stock_threshold !== undefined
            ? parsed.data.low_stock_threshold === null
              ? null
              : String(parsed.data.low_stock_threshold)
            : undefined,
        isActive: parsed.data.is_active,
      },
    });
    return { data: serializeInventoryItem(item) };
  },
);

/** DELETE /api/v1/inventory-items/{id} — soft delete (deleted_at). */
const deleteQuerySchema = z.object({ organization_id: z.string().uuid() });

export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = deleteQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }
    const item = await deleteInventoryItem(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      inventoryItemId: context.params.id,
    });
    return { data: serializeInventoryItem(item) };
  },
);
