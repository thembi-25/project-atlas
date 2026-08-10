import { getEstimateForPortalContact } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { withApiHandler } from '@/lib/route-handler';
import { serializeEstimate, serializeEstimateLineItem } from '@/lib/financials-serializers';

/** GET /api/v1/portal/estimates/{id} — Customer Portal Estimate view. Lives under a distinct `/api/v1/portal/*` path per docs/06-modules/customer-portal-prd.md's explicit routing-layer scoping requirement — never reuses the staff `/api/v1/estimates/{id}` endpoint. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(
  async (_request, context) => {
    const actor = await getAuthenticatedUser();
    const result = await getEstimateForPortalContact(getDb(), {
      portalUserId: actor.id,
      estimateId: context.params.id,
    });
    return {
      data: {
        estimate: serializeEstimate(result.estimate),
        line_items: result.lineItems.map(serializeEstimateLineItem),
      },
    };
  },
);
