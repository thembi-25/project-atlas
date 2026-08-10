import { z } from 'zod';
import { deleteInventoryLocation, updateInventoryLocation } from '@atlas/inventory';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeInventoryLocation } from '@/lib/inventory-serializers';

/** PATCH /api/v1/inventory-locations/{id}. */
const updateSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  technician_user_id: z.string().uuid().nullable().optional(),
});

export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid Inventory Location payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }
    const location = await updateInventoryLocation(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      locationId: context.params.id,
      fields: { name: parsed.data.name, technicianUserId: parsed.data.technician_user_id },
    });
    return { data: serializeInventoryLocation(location) };
  },
);

/** DELETE /api/v1/inventory-locations/{id} — soft delete (deleted_at). */
const deleteQuerySchema = z.object({ organization_id: z.string().uuid() });

export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = deleteQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }
    const location = await deleteInventoryLocation(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      locationId: context.params.id,
    });
    return { data: serializeInventoryLocation(location) };
  },
);
