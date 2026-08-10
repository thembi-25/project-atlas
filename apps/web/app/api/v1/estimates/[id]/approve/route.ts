import { z } from 'zod';
import { approveEstimateAsStaff } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeEstimate } from '@/lib/financials-serializers';

/** POST /api/v1/estimates/{id}/approve — estimates.md: staff capturing the Customer's decision in person, with `approved_by_user_id`. See /api/v1/portal/estimates/{id}/approve for the Portal's own Contact-initiated path. */
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
    const estimate = await approveEstimateAsStaff(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      estimateId: context.params.id,
    });
    return { data: serializeEstimate(estimate) };
  },
);
