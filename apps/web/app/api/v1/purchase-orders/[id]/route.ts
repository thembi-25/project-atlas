import { z } from 'zod';
import { getPurchaseOrder, updatePurchaseOrder } from '@atlas/suppliers';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import {
  serializePurchaseOrder,
  serializePurchaseOrderLineItem,
} from '@/lib/inventory-serializers';

/** GET /api/v1/purchase-orders/{id} — suppliers-prd.md §11. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const result = await getPurchaseOrder(getDb(), {
    organizationId,
    actorUserId: actor.id,
    purchaseOrderId: context.params.id,
  });
  return {
    data: {
      purchase_order: serializePurchaseOrder(result.purchaseOrder),
      line_items: result.lineItems.map(serializePurchaseOrderLineItem),
    },
  };
});

/** PATCH /api/v1/purchase-orders/{id} — suppliers.md: only meaningful while `draft`; status transitions go through /order, /receive, /cancel. */
const updateSchema = z.object({
  organization_id: z.string().uuid(),
  supplier_id: z.string().uuid().optional(),
  receiving_location_id: z.string().uuid().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid Purchase Order payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const purchaseOrder = await updatePurchaseOrder(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      purchaseOrderId: context.params.id,
      fields: {
        supplierId: parsed.data.supplier_id,
        receivingLocationId: parsed.data.receiving_location_id,
        notes: parsed.data.notes,
      },
    });
    return { data: serializePurchaseOrder(purchaseOrder) };
  },
);
