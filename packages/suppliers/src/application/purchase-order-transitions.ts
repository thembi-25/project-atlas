import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { insertStockMovement } from '@atlas/inventory';
import {
  InvalidPurchaseOrderStateError,
  NotFoundError,
  PurchaseOrderReceiptError,
} from '../domain/errors';
import { canTransitionPurchaseOrderStatus } from '../domain/lifecycle';
import {
  findPurchaseOrderById,
  updatePurchaseOrderStatus,
  type PurchaseOrder,
} from '../infrastructure/purchase-orders';
import {
  listLineItemsForPurchaseOrder,
  setLineItemQuantityReceived,
  type PurchaseOrderLineItem,
} from '../infrastructure/purchase-order-line-items';
import { requireInventoryPermission } from './authorize';

async function loadOwnedPurchaseOrder(
  tx: DatabaseClient,
  organizationId: string,
  purchaseOrderId: string,
): Promise<PurchaseOrder> {
  const po = await findPurchaseOrderById(tx, purchaseOrderId);
  if (!po || po.organizationId !== organizationId) {
    throw new NotFoundError('Purchase Order');
  }
  return po;
}

export interface MarkPurchaseOrderOrderedParams {
  organizationId: string;
  actorUserId: string;
  purchaseOrderId: string;
}

export async function markPurchaseOrderOrdered(
  db: DatabaseClient,
  params: MarkPurchaseOrderOrderedParams,
): Promise<PurchaseOrder> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const po = await loadOwnedPurchaseOrder(tx, params.organizationId, params.purchaseOrderId);
    if (!canTransitionPurchaseOrderStatus(po.status, 'ordered')) {
      throw new InvalidPurchaseOrderStateError(
        `Cannot mark a "${po.status}" Purchase Order as ordered.`,
      );
    }
    return updatePurchaseOrderStatus(tx, po.id, { status: 'ordered', orderedAt: new Date() });
  });
}

export interface CancelPurchaseOrderParams {
  organizationId: string;
  actorUserId: string;
  purchaseOrderId: string;
}

export async function cancelPurchaseOrder(
  db: DatabaseClient,
  params: CancelPurchaseOrderParams,
): Promise<PurchaseOrder> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const po = await loadOwnedPurchaseOrder(tx, params.organizationId, params.purchaseOrderId);
    if (!canTransitionPurchaseOrderStatus(po.status, 'cancelled')) {
      throw new InvalidPurchaseOrderStateError(`Cannot cancel a "${po.status}" Purchase Order.`);
    }
    return updatePurchaseOrderStatus(tx, po.id, { status: 'cancelled' });
  });
}

export interface ReceivePurchaseOrderLineInput {
  lineItemId: string;
  quantityReceived: string;
}

export interface ReceivePurchaseOrderParams {
  organizationId: string;
  actorUserId: string;
  purchaseOrderId: string;
  lines: ReceivePurchaseOrderLineInput[];
}

export interface ReceivePurchaseOrderResult {
  purchaseOrder: PurchaseOrder;
  lineItems: PurchaseOrderLineItem[];
  fullyReceived: boolean;
}

/**
 * suppliers-prd.md §13/§17: "receive" action that creates corresponding
 * `stock_movements` entries; supports partial receipt (some line items
 * received, others still outstanding), leaving the PO `ordered` until
 * every line is fully received. suppliers-prd.md §16: receiving more
 * than the remaining ordered-minus-already-received quantity on any
 * line is a 422, not a silently-accepted mismatch.
 */
export async function receivePurchaseOrder(
  db: DatabaseClient,
  params: ReceivePurchaseOrderParams,
): Promise<ReceivePurchaseOrderResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const po = await loadOwnedPurchaseOrder(tx, params.organizationId, params.purchaseOrderId);
    if (po.status !== 'ordered') {
      throw new InvalidPurchaseOrderStateError(
        `Cannot receive against a "${po.status}" Purchase Order; it must be "ordered".`,
      );
    }

    const existingLines = await listLineItemsForPurchaseOrder(tx, po.id);
    const linesById = new Map(existingLines.map((l) => [l.id, l]));

    const updatedLineItems: PurchaseOrderLineItem[] = [];
    for (const receipt of params.lines) {
      const line = linesById.get(receipt.lineItemId);
      if (!line || line.purchaseOrderId !== po.id) {
        throw new NotFoundError('Purchase Order line item');
      }
      const alreadyReceived = Number(line.quantityReceived);
      const ordered = Number(line.quantityOrdered);
      const receiving = Number(receipt.quantityReceived);
      if (!Number.isFinite(receiving) || receiving <= 0) {
        throw new PurchaseOrderReceiptError('Received quantity must be a positive number.');
      }
      const newTotal = alreadyReceived + receiving;
      if (newTotal > ordered) {
        throw new PurchaseOrderReceiptError(
          `Receiving ${receiving} would bring total received to ${newTotal}, exceeding the ${ordered} ordered for this line.`,
        );
      }

      await insertStockMovement(tx, {
        organizationId: params.organizationId,
        inventoryItemId: line.inventoryItemId,
        locationId: po.receivingLocationId,
        reason: 'received',
        quantityDelta: String(receiving),
        notes: `Received against Purchase Order ${po.id}`,
        createdByUserId: params.actorUserId,
      });

      updatedLineItems.push(await setLineItemQuantityReceived(tx, line.id, String(newTotal)));
    }

    const allLines = existingLines.map((l) => updatedLineItems.find((u) => u.id === l.id) ?? l);
    const fullyReceived = allLines.every(
      (l) => Number(l.quantityReceived) >= Number(l.quantityOrdered),
    );

    const purchaseOrder = fullyReceived
      ? await updatePurchaseOrderStatus(tx, po.id, { status: 'received', receivedAt: new Date() })
      : po;

    return { purchaseOrder, lineItems: allLines, fullyReceived };
  });
}
