import { z } from 'zod';
import { cancelPurchaseOrder } from '@atlas/suppliers';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializePurchaseOrder } from '@/lib/inventory-serializers';

/** POST /api/v1/purchase-orders/{id}/cancel — suppliers.md State machine: `draft|ordered -> cancelled`. */
const schema = z.object({ organization_id: z.string().uuid() });

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new AppError('validation_error', 'organization_id is required.', [
        { field: 'organization_id', issue: 'required' },
      ]);
    }
    const purchaseOrder = await cancelPurchaseOrder(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      purchaseOrderId: context.params.id,
    });
    return { data: serializePurchaseOrder(purchaseOrder) };
  },
);
