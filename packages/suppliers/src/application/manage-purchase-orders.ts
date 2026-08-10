import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findInventoryItemById, findInventoryLocationById } from '@atlas/inventory';
import { InvalidPurchaseOrderStateError, NotFoundError } from '../domain/errors';
import { findSupplierById } from '../infrastructure/suppliers';
import {
  findPurchaseOrderById,
  insertPurchaseOrder,
  listPurchaseOrdersForOrganization,
  updatePurchaseOrderDraftFields,
  type PurchaseOrder,
  type UpdatePurchaseOrderDraftFields,
} from '../infrastructure/purchase-orders';
import {
  insertPurchaseOrderLineItem,
  listLineItemsForPurchaseOrder,
  type PurchaseOrderLineItem,
} from '../infrastructure/purchase-order-line-items';
import type { PurchaseOrderStatus } from '../domain/lifecycle';
import { requireInventoryPermission } from './authorize';

async function assertPurchaseOrderReferencesBelongToOrg(
  tx: DatabaseClient,
  organizationId: string,
  supplierId: string,
  receivingLocationId: string,
): Promise<void> {
  const supplier = await findSupplierById(tx, supplierId);
  if (!supplier || supplier.organizationId !== organizationId) {
    throw new NotFoundError('Supplier');
  }
  const location = await findInventoryLocationById(tx, receivingLocationId);
  if (!location || location.organizationId !== organizationId) {
    throw new NotFoundError('Inventory Location');
  }
}

export interface CreatePurchaseOrderLineItemInput {
  inventoryItemId: string;
  quantityOrdered: string;
  unitCost: string;
}

export interface CreatePurchaseOrderParams {
  organizationId: string;
  actorUserId: string;
  supplierId: string;
  receivingLocationId: string;
  notes?: string | null | undefined;
  lineItems: CreatePurchaseOrderLineItemInput[];
}

export interface PurchaseOrderWithLineItems {
  purchaseOrder: PurchaseOrder;
  lineItems: PurchaseOrderLineItem[];
}

/** suppliers-prd.md §7: "basic Purchase Order creation (line items, status, received date)." Always created in `draft` status. */
export async function createPurchaseOrder(
  db: DatabaseClient,
  params: CreatePurchaseOrderParams,
): Promise<PurchaseOrderWithLineItems> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    await assertPurchaseOrderReferencesBelongToOrg(
      tx,
      params.organizationId,
      params.supplierId,
      params.receivingLocationId,
    );

    const purchaseOrder = await insertPurchaseOrder(tx, params);

    const lineItems: PurchaseOrderLineItem[] = [];
    for (const [index, line] of params.lineItems.entries()) {
      const item = await findInventoryItemById(tx, line.inventoryItemId);
      if (!item || item.organizationId !== params.organizationId) {
        throw new NotFoundError('Inventory Item');
      }
      lineItems.push(
        await insertPurchaseOrderLineItem(tx, {
          organizationId: params.organizationId,
          purchaseOrderId: purchaseOrder.id,
          inventoryItemId: line.inventoryItemId,
          quantityOrdered: line.quantityOrdered,
          unitCost: line.unitCost,
          sortOrder: index,
        }),
      );
    }

    return { purchaseOrder, lineItems };
  });
}

export interface GetPurchaseOrderParams {
  organizationId: string;
  actorUserId: string;
  purchaseOrderId: string;
}

export async function getPurchaseOrder(
  db: DatabaseClient,
  params: GetPurchaseOrderParams,
): Promise<PurchaseOrderWithLineItems> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'read' });
    const purchaseOrder = await findPurchaseOrderById(tx, params.purchaseOrderId);
    if (!purchaseOrder || purchaseOrder.organizationId !== params.organizationId) {
      throw new NotFoundError('Purchase Order');
    }
    const lineItems = await listLineItemsForPurchaseOrder(tx, purchaseOrder.id);
    return { purchaseOrder, lineItems };
  });
}

export interface ListPurchaseOrdersParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: { sortValue: string; id: string } | undefined;
  sortDirection: 'asc' | 'desc';
  status?: PurchaseOrderStatus | undefined;
}

export async function listPurchaseOrders(
  db: DatabaseClient,
  params: ListPurchaseOrdersParams,
): Promise<{ rows: PurchaseOrder[]; hasMore: boolean }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'read' });
    return listPurchaseOrdersForOrganization(tx, params);
  });
}

export interface UpdatePurchaseOrderParams {
  organizationId: string;
  actorUserId: string;
  purchaseOrderId: string;
  fields: UpdatePurchaseOrderDraftFields;
}

/** suppliers.md: only meaningful to edit while still `draft` — status transitions go through `purchase-order-transitions.ts` instead. */
export async function updatePurchaseOrder(
  db: DatabaseClient,
  params: UpdatePurchaseOrderParams,
): Promise<PurchaseOrder> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const existing = await findPurchaseOrderById(tx, params.purchaseOrderId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Purchase Order');
    }
    if (existing.status !== 'draft') {
      throw new InvalidPurchaseOrderStateError(
        'Only a draft Purchase Order can be edited; use a transition action instead.',
      );
    }
    if (params.fields.supplierId || params.fields.receivingLocationId) {
      await assertPurchaseOrderReferencesBelongToOrg(
        tx,
        params.organizationId,
        params.fields.supplierId ?? existing.supplierId,
        params.fields.receivingLocationId ?? existing.receivingLocationId,
      );
    }
    return updatePurchaseOrderDraftFields(tx, params.purchaseOrderId, params.fields);
  });
}
