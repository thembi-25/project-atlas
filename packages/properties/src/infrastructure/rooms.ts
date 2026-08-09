import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type Room = typeof schema.rooms.$inferSelect;
export type RoomType = NonNullable<Room['roomType']>;

export interface CreateRoomInput {
  organizationId: string;
  buildingId: string;
  name: string;
  roomType?: RoomType | undefined;
  floorLevel?: number | undefined;
}

export async function insertRoom(tx: DatabaseClient, input: CreateRoomInput): Promise<Room> {
  const [room] = await tx
    .insert(schema.rooms)
    .values({
      organizationId: input.organizationId,
      buildingId: input.buildingId,
      name: input.name,
      roomType: input.roomType ?? null,
      floorLevel: input.floorLevel ?? null,
    })
    .returning();
  if (!room) {
    throw new Error('Failed to insert room');
  }
  return room;
}

export async function findRoomById(
  tx: DatabaseClient,
  roomId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Room | undefined> {
  const conditions = [eq(schema.rooms.id, roomId)];
  if (!options.includeDeleted) {
    conditions.push(isNull(schema.rooms.deletedAt));
  }
  const [room] = await tx
    .select()
    .from(schema.rooms)
    .where(and(...conditions))
    .limit(1);
  return room;
}

export async function listRoomsForBuilding(
  tx: DatabaseClient,
  buildingId: string,
): Promise<Room[]> {
  return tx
    .select()
    .from(schema.rooms)
    .where(and(eq(schema.rooms.buildingId, buildingId), isNull(schema.rooms.deletedAt)))
    .orderBy(schema.rooms.createdAt);
}

export interface UpdateRoomFields {
  name?: string | undefined;
  roomType?: RoomType | null | undefined;
  floorLevel?: number | null | undefined;
}

export async function updateRoomFields(
  tx: DatabaseClient,
  roomId: string,
  fields: UpdateRoomFields,
): Promise<Room | undefined> {
  const [room] = await tx
    .update(schema.rooms)
    .set({
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.roomType !== undefined ? { roomType: fields.roomType } : {}),
      ...(fields.floorLevel !== undefined ? { floorLevel: fields.floorLevel } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.rooms.id, roomId), isNull(schema.rooms.deletedAt)))
    .returning();
  return room;
}

export async function setRoomDeletedAt(
  tx: DatabaseClient,
  roomId: string,
  deletedAt: Date | null,
): Promise<Room | undefined> {
  const [room] = await tx
    .update(schema.rooms)
    .set({ deletedAt, updatedAt: new Date() })
    .where(eq(schema.rooms.id, roomId))
    .returning();
  return room;
}

/** rooms.md business rule 2: blocked while it has any non-deleted Asset directly located in it. */
export async function hasActiveAssetsForRoom(tx: DatabaseClient, roomId: string): Promise<boolean> {
  const rows = await tx.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM properties.assets a WHERE a.room_id = ${roomId}::uuid AND a.deleted_at IS NULL
    ) AS exists
  `);
  return rows[0]?.exists ?? false;
}
