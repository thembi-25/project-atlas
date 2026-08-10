import { z } from 'zod';
import { rejectEstimateAsPortalContact } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { withApiHandler } from '@/lib/route-handler';
import { serializeEstimate } from '@/lib/financials-serializers';

const schema = z.object({ reason: z.string().max(1000).optional() });

/** POST /api/v1/portal/estimates/{id}/reject — customer-portal-prd.md: the Estimate approve/reject view. */
export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(json ?? {});
    const estimate = await rejectEstimateAsPortalContact(getDb(), {
      portalUserId: actor.id,
      estimateId: context.params.id,
      reason: parsed.success ? parsed.data.reason : undefined,
    });
    return { data: serializeEstimate(estimate) };
  },
);
