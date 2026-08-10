import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError } from '../domain/errors';
import { validateStockMovementInput, type StockMovementReason } from '../domain/stock';
import { findInventoryItemById } from '../infrastructure/inventory-items';
import { findInventoryLocationById } from '../infrastructure/inventory-locations';
import { insertStockMovement, type StockMovement } from '../infrastructure/stock-movements';
import { requireInventoryPermission } from './authorize';

async function assertItemAndLocationBelongToOrg(
  tx: DatabaseClient,
  organizationId: string,
  inventoryItemId: string,
  locationId: string,
): Promise<void> {
  const item = await findInventoryItemById(tx, inventoryItemId);
  if (!item || item.organizationId !== organizationId) {
    throw new NotFoundError('Inventory Item');
  }
  const location = await findInventoryLocationById(tx, locationId);
  if (!location || location.organizationId !== organizationId) {
    throw new NotFoundError('Inventory Location');
  }
}

/**
 * inventory-prd.md §11: "stock adjustment endpoints (always creating a
 * `stock_movements` row, never a direct UPDATE to a quantity field)."
 * Covers `received` (manual restock outside a Purchase Order) and
 * `adjusted` (physical-count reconciliation, `notes` required) —
 * `consumed_on_job` goes through `consume-part.ts` instead, and
 * `received` movements caused by a Purchase Order receipt go through
 * @atlas/suppliers's transition endpoint, which calls this same function.
 */
export interface AdjustStockParams {
  organizationId: string;
  actorUserId: string;
  inventoryItemId: string;
  locationId: string;
  reason: Exclude<StockMovementReason, 'consumed_on_job' | 'transferred'>;
  quantityDelta: string;
  notes?: string | null | undefined;
}

export async function adjustStock(
  db: DatabaseClient,
  params: AdjustStockParams,
): Promise<StockMovement> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    await assertItemAndLocationBelongToOrg(
      tx,
      params.organizationId,
      params.inventoryItemId,
      params.locationId,
    );
    validateStockMovementInput({
      reason: params.reason,
      quantityDelta: Number(params.quantityDelta),
      notes: params.notes,
    });
    return insertStockMovement(tx, {
      organizationId: params.organizationId,
      inventoryItemId: params.inventoryItemId,
      locationId: params.locationId,
      reason: params.reason,
      quantityDelta: params.quantityDelta,
      notes: params.notes,
      createdByUserId: params.actorUserId,
    });
  });
}

/**
 * inventory.md Edge Cases: "A part is consumed from a location other than
 * the Technician's assigned truck (borrowed from another truck)" implies
 * Locations can hold each other's stock; a Transfer moves quantity from
 * one Location to another as two linked movements in one transaction —
 * `transferred`-out (negative) at the source, `transferred`-in (positive)
 * at the destination.
 */
export interface TransferStockParams {
  organizationId: string;
  actorUserId: string;
  inventoryItemId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: string;
  notes?: string | null | undefined;
}

export async function transferStock(
  db: DatabaseClient,
  params: TransferStockParams,
): Promise<{ outMovement: StockMovement; inMovement: StockMovement }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    await assertItemAndLocationBelongToOrg(
      tx,
      params.organizationId,
      params.inventoryItemId,
      params.fromLocationId,
    );
    await assertItemAndLocationBelongToOrg(
      tx,
      params.organizationId,
      params.inventoryItemId,
      params.toLocationId,
    );
    const quantity = Number(params.quantity);
    validateStockMovementInput({
      reason: 'transferred',
      quantityDelta: -quantity,
      notes: params.notes,
    });
    const outMovement = await insertStockMovement(tx, {
      organizationId: params.organizationId,
      inventoryItemId: params.inventoryItemId,
      locationId: params.fromLocationId,
      reason: 'transferred',
      quantityDelta: String(-quantity),
      notes: params.notes,
      createdByUserId: params.actorUserId,
    });
    const inMovement = await insertStockMovement(tx, {
      organizationId: params.organizationId,
      inventoryItemId: params.inventoryItemId,
      locationId: params.toLocationId,
      reason: 'transferred',
      quantityDelta: String(quantity),
      notes: params.notes,
      createdByUserId: params.actorUserId,
    });
    return { outMovement, inMovement };
  });
}
