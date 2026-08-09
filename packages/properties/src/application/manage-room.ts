import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError, RoomHasActiveRecordsError } from '../domain/errors';
import { findBuildingById } from '../infrastructure/buildings';
import {
  findRoomById,
  hasActiveAssetsForRoom,
  insertRoom,
  listRoomsForBuilding,
  setRoomDeletedAt,
  updateRoomFields,
  type Room,
  type RoomType,
} from '../infrastructure/rooms';
import { requirePropertiesPermission } from './authorize';

export interface CreateRoomParams {
  organizationId: string;
  actorUserId: string;
  buildingId: string;
  name: string;
  roomType?: RoomType | undefined;
  floorLevel?: number | undefined;
}

export async function createRoom(db: DatabaseClient, params: CreateRoomParams): Promise<Room> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'write' });
    const building = await findBuildingById(tx, params.buildingId);
    if (!building || building.organizationId !== params.organizationId) {
      throw new NotFoundError('Building');
    }
    return insertRoom(tx, {
      organizationId: params.organizationId,
      buildingId: params.buildingId,
      name: params.name,
      roomType: params.roomType,
      floorLevel: params.floorLevel,
    });
  });
}

export interface GetRoomParams {
  organizationId: string;
  actorUserId: string;
  roomId: string;
}

export async function getRoom(db: DatabaseClient, params: GetRoomParams): Promise<Room> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    const room = await findRoomById(tx, params.roomId);
    if (!room || room.organizationId !== params.organizationId) {
      throw new NotFoundError('Room');
    }
    return room;
  });
}

export interface ListRoomsParams {
  organizationId: string;
  actorUserId: string;
  buildingId: string;
}

export async function listRooms(db: DatabaseClient, params: ListRoomsParams): Promise<Room[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    const building = await findBuildingById(tx, params.buildingId);
    if (!building || building.organizationId !== params.organizationId) {
      throw new NotFoundError('Building');
    }
    return listRoomsForBuilding(tx, params.buildingId);
  });
}

export interface UpdateRoomParams {
  organizationId: string;
  actorUserId: string;
  roomId: string;
  fields: {
    name?: string | undefined;
    roomType?: RoomType | null | undefined;
    floorLevel?: number | null | undefined;
  };
}

export async function updateRoom(db: DatabaseClient, params: UpdateRoomParams): Promise<Room> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'write' });
    const existing = await findRoomById(tx, params.roomId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Room');
    }
    const updated = await updateRoomFields(tx, params.roomId, params.fields);
    if (!updated) {
      throw new NotFoundError('Room');
    }
    return updated;
  });
}

export interface ArchiveRoomParams {
  organizationId: string;
  actorUserId: string;
  roomId: string;
}

/** rooms.md business rule 2: blocked while it has any non-deleted Asset directly located in it. */
export async function archiveRoom(db: DatabaseClient, params: ArchiveRoomParams): Promise<Room> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'delete' });
    const existing = await findRoomById(tx, params.roomId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Room');
    }
    if (await hasActiveAssetsForRoom(tx, params.roomId)) {
      throw new RoomHasActiveRecordsError();
    }
    const archived = await setRoomDeletedAt(tx, params.roomId, new Date());
    if (!archived) {
      throw new NotFoundError('Room');
    }
    return archived;
  });
}
