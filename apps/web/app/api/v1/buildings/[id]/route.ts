import { z } from 'zod';
import { archiveBuilding, getBuilding, updateBuilding } from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeBuilding } from '@/lib/properties-serializers';

const BUILDING_TYPES = ['main', 'detached_garage', 'outbuilding', 'unit'] as const;

/** GET /api/v1/buildings/{id} */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const building = await getBuilding(getDb(), {
    organizationId,
    actorUserId: actor.id,
    buildingId: context.params.id,
  });
  return { data: serializeBuilding(building) };
});

const patchBuildingSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  building_type: z.enum(BUILDING_TYPES).nullable().optional(),
  floor_count: z.number().int().positive().nullable().optional(),
  year_built: z.number().int().min(1600).max(2100).nullable().optional(),
});

/** PATCH /api/v1/buildings/{id} */
export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = patchBuildingSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid building payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const building = await updateBuilding(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      buildingId: context.params.id,
      fields: {
        name: parsed.data.name,
        buildingType: parsed.data.building_type,
        floorCount: parsed.data.floor_count,
        yearBuilt: parsed.data.year_built,
      },
    });
    return { data: serializeBuilding(building) };
  },
);

const deleteBuildingQuerySchema = z.object({ organization_id: z.string().uuid() });

/**
 * DELETE /api/v1/buildings/{id} — soft-delete. buildings.md business rule
 * 2: blocked (`409`) while any non-deleted Room or Asset references this
 * Building.
 */
export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = deleteBuildingQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }

    const building = await archiveBuilding(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      buildingId: context.params.id,
    });
    return { data: serializeBuilding(building) };
  },
);
