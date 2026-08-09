import { z } from 'zod';
import { archiveRoom, getRoom, updateRoom } from '@atlas/properties';
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

/** GET /api/v1/rooms/{id} */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const room = await getRoom(getDb(), {
    organizationId,
    actorUserId: actor.id,
    roomId: context.params.id,
  });
  return { data: serializeRoom(room) };
});

const patchRoomSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  room_type: z.enum(ROOM_TYPES).nullable().optional(),
  floor_level: z.number().int().nullable().optional(),
});

/** PATCH /api/v1/rooms/{id} */
export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = patchRoomSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid room payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const room = await updateRoom(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      roomId: context.params.id,
      fields: {
        name: parsed.data.name,
        roomType: parsed.data.room_type,
        floorLevel: parsed.data.floor_level,
      },
    });
    return { data: serializeRoom(room) };
  },
);

const deleteRoomQuerySchema = z.object({ organization_id: z.string().uuid() });

/**
 * DELETE /api/v1/rooms/{id} — soft-delete. rooms.md business rule 2:
 * blocked (`409`) while any non-deleted Asset is directly located in
 * this Room.
 */
export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = deleteRoomQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }

    const room = await archiveRoom(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      roomId: context.params.id,
    });
    return { data: serializeRoom(room) };
  },
);
