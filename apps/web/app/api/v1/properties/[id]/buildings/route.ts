import { z } from 'zod';
import { createBuilding, listBuildings } from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeBuilding } from '@/lib/properties-serializers';

const BUILDING_TYPES = ['main', 'detached_garage', 'outbuilding', 'unit'] as const;

/**
 * GET/POST /api/v1/properties/{id}/buildings — properties-prd.md §7's
 * "CRUD for Properties/Buildings/Rooms" functional requirement, following
 * docs/05-api/resource-conventions.md's nested-subresource pattern (no
 * dedicated Buildings endpoint list appears in §11, which only itemizes
 * the Property-level endpoints — see docs/13-roadmap/
 * SPRINT-3-COMPLETION-REPORT.md, "Deviations From Documentation").
 */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const buildings = await listBuildings(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyId: context.params.id,
  });
  return { data: buildings.map(serializeBuilding) };
});

const createBuildingSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  building_type: z.enum(BUILDING_TYPES).optional(),
  floor_count: z.number().int().positive().optional(),
  year_built: z.number().int().min(1600).max(2100).optional(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = createBuildingSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid building payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const building = await createBuilding(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      propertyId: context.params.id,
      name: parsed.data.name,
      buildingType: parsed.data.building_type,
      floorCount: parsed.data.floor_count,
      yearBuilt: parsed.data.year_built,
    });
    return { data: serializeBuilding(building), status: 201 };
  },
);
