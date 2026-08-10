import { z } from 'zod';
import { receivePurchaseOrder } from '@atlas/suppliers';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import {
  serializePurchaseOrder,
  serializePurchaseOrderLineItem,
} from '@/lib/inventory-serializers';

/** POST /api/v1/purchase-orders/{id}/receive — suppliers-prd.md §13: "'receive' action that creates corresponding `stock_movements` entries," supporting full or partial receipt. */
const schema = z.object({
  organization_id: z.string().uuid(),
  lines: z
    .array(
      z.object({
        line_item_id: z.string().uuid(),
        quantity_received: z.number().positive(),
      }),
    )
    .min(1),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid receipt payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const result = await receivePurchaseOrder(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      purchaseOrderId: context.params.id,
      lines: parsed.data.lines.map((line) => ({
        lineItemId: line.line_item_id,
        quantityReceived: String(line.quantity_received),
      })),
    });
    return {
      data: {
        purchase_order: serializePurchaseOrder(result.purchaseOrder),
        line_items: result.lineItems.map(serializePurchaseOrderLineItem),
        fully_received: result.fullyReceived,
      },
    };
  },
);
