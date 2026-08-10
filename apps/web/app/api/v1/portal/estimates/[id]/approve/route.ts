import { approveEstimateAsPortalContact } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { withApiHandler } from '@/lib/route-handler';
import { serializeEstimate } from '@/lib/financials-serializers';

/** POST /api/v1/portal/estimates/{id}/approve — customer-portal-prd.md: the Estimate approve/reject view. */
export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (_request, context) => {
    const actor = await getAuthenticatedUser();
    const estimate = await approveEstimateAsPortalContact(getDb(), {
      portalUserId: actor.id,
      estimateId: context.params.id,
    });
    return { data: serializeEstimate(estimate) };
  },
);
