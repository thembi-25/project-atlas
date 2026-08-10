import { and, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type PurchaseOrderLineItem = typeof schema.purchaseOrderLineItems.$inferSelect;

export async function insertPurchaseOrderLineItem(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    purchaseOrderId: string;
    inventoryItemId: string;
    quantityOrdered: string;
    unitCost: string;
    sortOrder?: number | undefined;
  },
): Promise<PurchaseOrderLineItem> {
  const [row] = await tx
    .insert(schema.purchaseOrderLineItems)
    .values({
      organizationId: input.organizationId,
      purchaseOrderId: input.purchaseOrderId,
      inventoryItemId: input.inventoryItemId,
      quantityOrdered: input.quantityOrdered,
      unitCost: input.unitCost,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  if (!row) throw new Error('Failed to create Purchase Order line item.');
  return row;
}

export async function listLineItemsForPurchaseOrder(
  tx: DatabaseClient,
  purchaseOrderId: string,
): Promise<PurchaseOrderLineItem[]> {
  return tx
    .select()
    .from(schema.purchaseOrderLineItems)
    .where(eq(schema.purchaseOrderLineItems.purchaseOrderId, purchaseOrderId))
    .orderBy(schema.purchaseOrderLineItems.sortOrder);
}

export async function setLineItemQuantityReceived(
  tx: DatabaseClient,
  id: string,
  quantityReceived: string,
): Promise<PurchaseOrderLineItem> {
  const [row] = await tx
    .update(schema.purchaseOrderLineItems)
    .set({ quantityReceived, updatedAt: new Date() })
    .where(eq(schema.purchaseOrderLineItems.id, id))
    .returning();
  if (!row) throw new Error('Failed to update Purchase Order line item.');
  return row;
}

export async function deleteLineItemsForPurchaseOrder(
  tx: DatabaseClient,
  organizationId: string,
  purchaseOrderId: string,
): Promise<void> {
  await tx
    .delete(schema.purchaseOrderLineItems)
    .where(
      and(
        eq(schema.purchaseOrderLineItems.organizationId, organizationId),
        eq(schema.purchaseOrderLineItems.purchaseOrderId, purchaseOrderId),
      ),
    );
}
