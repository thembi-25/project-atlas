import { z } from 'zod';
import { addCustomerAssociation, listCustomerAssociations } from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializePropertyCustomerAssociation } from '@/lib/properties-serializers';

/**
 * GET /api/v1/properties/{id}/customer-associations — current + historical,
 * newest first. Supports properties-prd.md §7's "association management"
 * functional requirement (not separately itemized in §11's endpoint list,
 * which only names the `POST` "add" action) and the Property detail
 * page's need to display the current Customer of record.
 */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const associations = await listCustomerAssociations(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyId: context.params.id,
  });
  return { data: associations.map(serializePropertyCustomerAssociation) };
});

const addAssociationSchema = z.object({
  organization_id: z.string().uuid(),
  customer_id: z.string().uuid(),
});

/**
 * POST /api/v1/properties/{id}/customer-associations — properties-prd.md
 * §11. Ends the current association (if any) and starts a new one.
 */
export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = addAssociationSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid customer-association payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const association = await addCustomerAssociation(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      propertyId: context.params.id,
      customerId: parsed.data.customer_id,
    });
    return { data: serializePropertyCustomerAssociation(association), status: 201 };
  },
);
