import { z } from 'zod';
import { adjustStock } from '@atlas/inventory';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeStockMovement } from '@/lib/inventory-serializers';

/** POST /api/v1/inventory-items/{id}/adjust — inventory-prd.md §11: "creates a `stock_movements` row, never a direct UPDATE to a quantity field." Covers `received` (manual restock) and `adjusted` (physical-count reconciliation). */
const schema = z.object({
  organization_id: z.string().uuid(),
  location_id: z.string().uuid(),
  reason: z.enum(['received', 'adjusted']),
  quantity_delta: z
    .number()
    .finite()
    .refine((n) => n !== 0, 'quantity_delta must not be zero.'),
  notes: z.string().max(1000).optional(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid stock adjustment payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const movement = await adjustStock(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      inventoryItemId: context.params.id,
      locationId: parsed.data.location_id,
      reason: parsed.data.reason,
      quantityDelta: String(parsed.data.quantity_delta),
      notes: parsed.data.notes,
    });
    return { data: serializeStockMovement(movement), status: 201 };
  },
);
