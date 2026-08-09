import { z } from 'zod';
import { endCustomerAssociation } from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializePropertyCustomerAssociation } from '@/lib/properties-serializers';

const endAssociationQuerySchema = z.object({ organization_id: z.string().uuid() });

/**
 * DELETE /api/v1/properties/{id}/customer-associations/{associationId} —
 * ends the association's validity (`effective_to`) without starting a
 * new one, leaving the Property with no current Customer of record —
 * properties-prd.md §7's "end an association without deleting the
 * Property."
 */
export const DELETE = withApiHandler<unknown, { params: { id: string; associationId: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = endAssociationQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }

    const association = await endCustomerAssociation(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      propertyId: context.params.id,
      associationId: context.params.associationId,
    });
    return { data: serializePropertyCustomerAssociation(association) };
  },
);
