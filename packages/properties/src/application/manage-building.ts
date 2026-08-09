import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { BuildingHasActiveRecordsError, NotFoundError } from '../domain/errors';
import { findPropertyById } from '../infrastructure/properties';
import {
  findBuildingById,
  hasActiveChildrenForBuilding,
  insertBuilding,
  listBuildingsForProperty,
  setBuildingDeletedAt,
  updateBuildingFields,
  type Building,
  type BuildingType,
} from '../infrastructure/buildings';
import { requirePropertiesPermission } from './authorize';

export interface CreateBuildingParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
  name: string;
  buildingType?: BuildingType | undefined;
  floorCount?: number | undefined;
  yearBuilt?: number | undefined;
}

export async function createBuilding(
  db: DatabaseClient,
  params: CreateBuildingParams,
): Promise<Building> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'write' });
    const property = await findPropertyById(tx, params.propertyId);
    if (!property || property.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    return insertBuilding(tx, {
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      name: params.name,
      buildingType: params.buildingType,
      floorCount: params.floorCount,
      yearBuilt: params.yearBuilt,
    });
  });
}

export interface GetBuildingParams {
  organizationId: string;
  actorUserId: string;
  buildingId: string;
}

export async function getBuilding(
  db: DatabaseClient,
  params: GetBuildingParams,
): Promise<Building> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    const building = await findBuildingById(tx, params.buildingId);
    if (!building || building.organizationId !== params.organizationId) {
      throw new NotFoundError('Building');
    }
    return building;
  });
}

export interface ListBuildingsParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
}

export async function listBuildings(
  db: DatabaseClient,
  params: ListBuildingsParams,
): Promise<Building[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    const property = await findPropertyById(tx, params.propertyId);
    if (!property || property.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    return listBuildingsForProperty(tx, params.propertyId);
  });
}

export interface UpdateBuildingParams {
  organizationId: string;
  actorUserId: string;
  buildingId: string;
  fields: {
    name?: string | undefined;
    buildingType?: BuildingType | null | undefined;
    floorCount?: number | null | undefined;
    yearBuilt?: number | null | undefined;
  };
}

export async function updateBuilding(
  db: DatabaseClient,
  params: UpdateBuildingParams,
): Promise<Building> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'write' });
    const existing = await findBuildingById(tx, params.buildingId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Building');
    }
    const updated = await updateBuildingFields(tx, params.buildingId, params.fields);
    if (!updated) {
      throw new NotFoundError('Building');
    }
    return updated;
  });
}

export interface ArchiveBuildingParams {
  organizationId: string;
  actorUserId: string;
  buildingId: string;
}

/** buildings.md business rule 2: blocked while it has any non-deleted Room or Asset. */
export async function archiveBuilding(
  db: DatabaseClient,
  params: ArchiveBuildingParams,
): Promise<Building> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'delete' });
    const existing = await findBuildingById(tx, params.buildingId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Building');
    }
    if (await hasActiveChildrenForBuilding(tx, params.buildingId)) {
      throw new BuildingHasActiveRecordsError();
    }
    const archived = await setBuildingDeletedAt(tx, params.buildingId, new Date());
    if (!archived) {
      throw new NotFoundError('Building');
    }
    return archived;
  });
}
