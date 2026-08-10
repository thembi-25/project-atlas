import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError } from '../domain/errors';
import {
  findInventoryLocationById,
  insertInventoryLocation,
  listInventoryLocationsForOrganization,
  setInventoryLocationDeletedAt,
  updateInventoryLocationFields,
  type InventoryLocation,
  type InventoryLocationType,
  type UpdateInventoryLocationFields,
} from '../infrastructure/inventory-locations';
import { requireInventoryPermission } from './authorize';

export interface CreateInventoryLocationParams {
  organizationId: string;
  actorUserId: string;
  type: InventoryLocationType;
  name: string;
  technicianUserId?: string | null | undefined;
}

export async function createInventoryLocation(
  db: DatabaseClient,
  params: CreateInventoryLocationParams,
): Promise<InventoryLocation> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    return insertInventoryLocation(tx, params);
  });
}

export interface ListInventoryLocationsParams {
  organizationId: string;
  actorUserId: string;
}

export async function listInventoryLocations(
  db: DatabaseClient,
  params: ListInventoryLocationsParams,
): Promise<InventoryLocation[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'read' });
    return listInventoryLocationsForOrganization(tx, params.organizationId);
  });
}

export interface UpdateInventoryLocationParams {
  organizationId: string;
  actorUserId: string;
  locationId: string;
  fields: UpdateInventoryLocationFields;
}

export async function updateInventoryLocation(
  db: DatabaseClient,
  params: UpdateInventoryLocationParams,
): Promise<InventoryLocation> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const existing = await findInventoryLocationById(tx, params.locationId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Inventory Location');
    }
    return updateInventoryLocationFields(tx, params.locationId, params.fields);
  });
}

export interface DeleteInventoryLocationParams {
  organizationId: string;
  actorUserId: string;
  locationId: string;
}

export async function deleteInventoryLocation(
  db: DatabaseClient,
  params: DeleteInventoryLocationParams,
): Promise<InventoryLocation> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const existing = await findInventoryLocationById(tx, params.locationId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Inventory Location');
    }
    return setInventoryLocationDeletedAt(tx, params.locationId);
  });
}
