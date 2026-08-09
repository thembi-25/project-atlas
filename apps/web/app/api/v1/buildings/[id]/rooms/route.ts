import { z } from 'zod';
import { createRoom, listRooms } from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeRoom } from '@/lib/properties-serializers';

const ROOM_TYPES = [
  'kitchen',
  'bathroom',
  'utility',
  'attic',
  'basement',
  'garage',
  'other',
] as const;

/** GET/POST /api/v1/buildings/{id}/rooms — see properties/[id]/buildings/route.ts for the nested-resource rationale. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const rooms = await listRooms(getDb(), {
    organizationId,
    actorUserId: actor.id,
    buildingId: context.params.id,
  });
  return { data: rooms.map(serializeRoom) };
});

const createRoomSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  room_type: z.enum(ROOM_TYPES).optional(),
  floor_level: z.number().int().optional(),
});

export const POST = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = createRoomSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid room payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const room = await createRoom(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      buildingId: context.params.id,
      name: parsed.data.name,
      roomType: parsed.data.room_type,
      floorLevel: parsed.data.floor_level,
    });
    return { data: serializeRoom(room), status: 201 };
  },
);
