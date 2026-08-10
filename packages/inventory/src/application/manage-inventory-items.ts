import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError } from '../domain/errors';
import {
  findInventoryItemById,
  insertInventoryItem,
  listInventoryItemsForOrganization,
  setInventoryItemDeletedAt,
  updateInventoryItemFields,
  type InventoryItem,
  type InventoryItemCursor,
  type InventoryItemSortField,
  type SortDirection,
  type UpdateInventoryItemFields,
} from '../infrastructure/inventory-items';
import { getQuantityOnHandByLocation } from '../infrastructure/stock-movements';
import { requireInventoryPermission } from './authorize';

export interface CreateInventoryItemParams {
  organizationId: string;
  actorUserId: string;
  sku: string;
  description: string;
  assetTypeId?: string | null | undefined;
  unitCost: string;
  defaultSellPrice?: string | null | undefined;
  lowStockThreshold?: string | null | undefined;
}

export async function createInventoryItem(
  db: DatabaseClient,
  params: CreateInventoryItemParams,
): Promise<InventoryItem> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    return insertInventoryItem(tx, params);
  });
}

export interface GetInventoryItemParams {
  organizationId: string;
  actorUserId: string;
  inventoryItemId: string;
}

export async function getInventoryItem(
  db: DatabaseClient,
  params: GetInventoryItemParams,
): Promise<{
  item: InventoryItem;
  quantityByLocation: { locationId: string; quantityOnHand: number }[];
}> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'read' });
    const item = await findInventoryItemById(tx, params.inventoryItemId);
    if (!item || item.organizationId !== params.organizationId) {
      throw new NotFoundError('Inventory Item');
    }
    const quantityByLocation = await getQuantityOnHandByLocation(tx, item.id);
    return { item, quantityByLocation };
  });
}

export interface ListInventoryItemsParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: InventoryItemCursor | undefined;
  sortField: InventoryItemSortField;
  sortDirection: SortDirection;
}

export async function listInventoryItems(
  db: DatabaseClient,
  params: ListInventoryItemsParams,
): Promise<{ rows: InventoryItem[]; hasMore: boolean }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'read' });
    return listInventoryItemsForOrganization(tx, params);
  });
}

export interface UpdateInventoryItemParams {
  organizationId: string;
  actorUserId: string;
  inventoryItemId: string;
  fields: UpdateInventoryItemFields;
}

export async function updateInventoryItem(
  db: DatabaseClient,
  params: UpdateInventoryItemParams,
): Promise<InventoryItem> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const existing = await findInventoryItemById(tx, params.inventoryItemId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Inventory Item');
    }
    return updateInventoryItemFields(tx, params.inventoryItemId, params.fields);
  });
}

export interface DeleteInventoryItemParams {
  organizationId: string;
  actorUserId: string;
  inventoryItemId: string;
}

export async function deleteInventoryItem(
  db: DatabaseClient,
  params: DeleteInventoryItemParams,
): Promise<InventoryItem> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const existing = await findInventoryItemById(tx, params.inventoryItemId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Inventory Item');
    }
    return setInventoryItemDeletedAt(tx, params.inventoryItemId);
  });
}
