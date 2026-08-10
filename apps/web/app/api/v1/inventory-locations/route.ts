import { z } from 'zod';
import { createInventoryLocation, listInventoryLocations } from '@atlas/inventory';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeInventoryLocation } from '@/lib/inventory-serializers';

/** GET /api/v1/inventory-locations — inventory.md Data requirements: `inventory_locations`. Not cursor-paginated (Organization-scoped location count is small, per-location UI columns need the full set at once). */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const locations = await listInventoryLocations(getDb(), {
    organizationId,
    actorUserId: actor.id,
  });
  return { data: locations.map(serializeInventoryLocation) };
});

/** POST /api/v1/inventory-locations. */
const createSchema = z.object({
  organization_id: z.string().uuid(),
  type: z.enum(['warehouse', 'truck']),
  name: z.string().min(1).max(200),
  technician_user_id: z.string().uuid().optional(),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid Inventory Location payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }
  const location = await createInventoryLocation(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    type: parsed.data.type,
    name: parsed.data.name,
    technicianUserId: parsed.data.technician_user_id,
  });
  return { data: serializeInventoryLocation(location), status: 201 };
});
