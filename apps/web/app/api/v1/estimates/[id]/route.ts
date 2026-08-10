import { z } from 'zod';
import { getEstimate, updateEstimateDraft } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeEstimate, serializeEstimateLineItem } from '@/lib/financials-serializers';

/** GET /api/v1/estimates/{id} — estimates.md. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const result = await getEstimate(getDb(), {
    organizationId,
    actorUserId: actor.id,
    estimateId: context.params.id,
  });
  return {
    data: {
      estimate: serializeEstimate(result.estimate),
      line_items: result.lineItems.map(serializeEstimateLineItem),
    },
  };
});

/** PATCH /api/v1/estimates/{id} — estimates.md: "update restricted to `draft`" — replaces the full line-item set. */
const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const updateEstimateSchema = z.object({
  organization_id: z.string().uuid(),
  tax_total: z.number().nonnegative().optional(),
  line_items: z.array(lineItemSchema).min(1),
});

export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = updateEstimateSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid estimate payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const result = await updateEstimateDraft(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      estimateId: context.params.id,
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
    };
  },
);
