import { z } from 'zod';
import { rejectEstimateAsStaff } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeEstimate } from '@/lib/financials-serializers';

/** POST /api/v1/estimates/{id}/reject — estimates.md#state-machine: `sent` -> `rejected`, staff recording on the Customer's behalf. */
const schema = z.object({
  organization_id: z.string().uuid(),
  reason: z.string().max(1000).optional(),
});

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
    const estimate = await rejectEstimateAsStaff(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      estimateId: context.params.id,
      reason: parsed.data.reason,
    });
    return { data: serializeEstimate(estimate) };
  },
);
