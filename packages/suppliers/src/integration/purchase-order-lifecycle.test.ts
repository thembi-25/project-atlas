import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createInventoryItem, createInventoryLocation, getQuantityOnHand } from '@atlas/inventory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  getPurchaseOrder,
  getSupplier,
  InvalidPurchaseOrderStateError,
  markPurchaseOrderOrdered,
  NotFoundError,
  PurchaseOrderReceiptError,
  receivePurchaseOrder,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * suppliers-prd.md §18 acceptance criteria: "Given a Purchase Order
 * marked fully received, when staff check Inventory, then each ordered
 * Inventory Item's quantity on hand reflects the received amount via a
 * corresponding stock_movements row." Plus §17 partial-receipt handling
 * and tenant isolation across two Organizations.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = {
  id: randomUUID(),
  email: `po-owner-a-${suffix}@example.test`,
  fullName: 'Owner A',
};
const ownerB = {
  id: randomUUID(),
  email: `po-owner-b-${suffix}@example.test`,
  fullName: 'Owner B',
};

let organizationAId: string;
let organizationBId: string;
let supplierAId: string;
let supplierBId: string;
let locationAId: string;
let locationBId: string;
let itemAId: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `PO Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;
  const orgB = await createOrganization(db, {
    name: `PO Org B ${suffix}`,
    tradeTypeIds: [],
    owner: ownerB,
  });
  organizationBId = orgB.organizationId;

  const supplierA = await createSupplier(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    name: `Supplier A ${suffix}`,
  });
  supplierAId = supplierA.id;
  const supplierB = await createSupplier(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    name: `Supplier B ${suffix}`,
  });
  supplierBId = supplierB.id;

  const locationA = await createInventoryLocation(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    type: 'warehouse',
    name: `PO Warehouse A ${suffix}`,
  });
  locationAId = locationA.id;
  const locationB = await createInventoryLocation(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    type: 'warehouse',
    name: `PO Warehouse B ${suffix}`,
  });
  locationBId = locationB.id;

  const itemA = await createInventoryItem(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    sku: `PO-ITEM-A-${suffix}`,
    description: 'PO Item A',
    unitCost: '8.00',
  });
  itemAId = itemA.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const orgId of [organizationAId, organizationBId]) {
      await tx
        .delete(schema.purchaseOrderLineItems)
        .where(eq(schema.purchaseOrderLineItems.organizationId, orgId));
      await tx.delete(schema.purchaseOrders).where(eq(schema.purchaseOrders.organizationId, orgId));
      await tx.delete(schema.suppliers).where(eq(schema.suppliers.organizationId, orgId));
      await tx.delete(schema.stockMovements).where(eq(schema.stockMovements.organizationId, orgId));
      await tx.delete(schema.inventoryItems).where(eq(schema.inventoryItems.organizationId, orgId));
      await tx
        .delete(schema.inventoryLocations)
        .where(eq(schema.inventoryLocations.organizationId, orgId));
      const memberships = await tx
        .select({ id: schema.organizationMemberships.id })
        .from(schema.organizationMemberships)
        .where(eq(schema.organizationMemberships.organizationId, orgId));
      for (const m of memberships) {
        await tx
          .delete(schema.membershipRoles)
          .where(eq(schema.membershipRoles.membershipId, m.id));
      }
      await tx
        .delete(schema.organizationMemberships)
        .where(eq(schema.organizationMemberships.organizationId, orgId));
      await tx.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
    }
    for (const user of [ownerA, ownerB]) {
      await tx.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
  await db.$client.end();
});

describe('Purchase Order lifecycle: draft -> ordered -> received', () => {
  it('creates a draft Purchase Order with line items', async () => {
    const result = await createPurchaseOrder(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      supplierId: supplierAId,
      receivingLocationId: locationAId,
      lineItems: [{ inventoryItemId: itemAId, quantityOrdered: '10', unitCost: '8.00' }],
    });
    expect(result.purchaseOrder.status).toBe('draft');
    expect(result.lineItems).toHaveLength(1);
  });

  it('cannot receive a draft Purchase Order — must be ordered first', async () => {
    const { purchaseOrder, lineItems } = await createPurchaseOrder(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      supplierId: supplierAId,
      receivingLocationId: locationAId,
      lineItems: [{ inventoryItemId: itemAId, quantityOrdered: '5', unitCost: '8.00' }],
    });
    await expect(
      receivePurchaseOrder(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        purchaseOrderId: purchaseOrder.id,
        lines: [{ lineItemId: lineItems[0]!.id, quantityReceived: '5' }],
      }),
    ).rejects.toThrow(InvalidPurchaseOrderStateError);
  });

  it('marks ordered, partially receives, then fully receives — updating stock_movements and status', async () => {
    const { purchaseOrder, lineItems } = await createPurchaseOrder(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      supplierId: supplierAId,
      receivingLocationId: locationAId,
      lineItems: [{ inventoryItemId: itemAId, quantityOrdered: '10', unitCost: '8.00' }],
    });
    const lineItemId = lineItems[0]!.id;

    const ordered = await markPurchaseOrderOrdered(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      purchaseOrderId: purchaseOrder.id,
    });
    expect(ordered.status).toBe('ordered');

    const quantityBefore = await withServiceContext(db, (tx) =>
      getQuantityOnHand(tx, { inventoryItemId: itemAId, locationId: locationAId }),
    );

    const partial = await receivePurchaseOrder(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      purchaseOrderId: purchaseOrder.id,
      lines: [{ lineItemId, quantityReceived: '4' }],
    });
    expect(partial.fullyReceived).toBe(false);
    expect(partial.purchaseOrder.status).toBe('ordered');

    const quantityAfterPartial = await withServiceContext(db, (tx) =>
      getQuantityOnHand(tx, { inventoryItemId: itemAId, locationId: locationAId }),
    );
    expect(quantityAfterPartial).toBe(quantityBefore + 4);

    const full = await receivePurchaseOrder(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      purchaseOrderId: purchaseOrder.id,
      lines: [{ lineItemId, quantityReceived: '6' }],
    });
    expect(full.fullyReceived).toBe(true);
    expect(full.purchaseOrder.status).toBe('received');
    expect(full.purchaseOrder.receivedAt).not.toBeNull();

    const quantityAfterFull = await withServiceContext(db, (tx) =>
      getQuantityOnHand(tx, { inventoryItemId: itemAId, locationId: locationAId }),
    );
    expect(quantityAfterFull).toBe(quantityBefore + 10);
  });

  it('rejects receiving more than the ordered-minus-already-received quantity — suppliers-prd.md §16', async () => {
    const { purchaseOrder, lineItems } = await createPurchaseOrder(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      supplierId: supplierAId,
      receivingLocationId: locationAId,
      lineItems: [{ inventoryItemId: itemAId, quantityOrdered: '3', unitCost: '8.00' }],
    });
    await markPurchaseOrderOrdered(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      purchaseOrderId: purchaseOrder.id,
    });
    await expect(
      receivePurchaseOrder(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        purchaseOrderId: purchaseOrder.id,
        lines: [{ lineItemId: lineItems[0]!.id, quantityReceived: '4' }],
      }),
    ).rejects.toThrow(PurchaseOrderReceiptError);
  });

  it('a draft or ordered Purchase Order can be cancelled; a received one cannot', async () => {
    const draft = await createPurchaseOrder(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      supplierId: supplierAId,
      receivingLocationId: locationAId,
      lineItems: [{ inventoryItemId: itemAId, quantityOrdered: '1', unitCost: '8.00' }],
    });
    const cancelled = await cancelPurchaseOrder(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      purchaseOrderId: draft.purchaseOrder.id,
    });
    expect(cancelled.status).toBe('cancelled');

    await expect(
      cancelPurchaseOrder(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        purchaseOrderId: cancelled.id,
      }),
    ).rejects.toThrow(InvalidPurchaseOrderStateError);
  });
});

describe('Suppliers/Purchase Orders tenant isolation', () => {
  it('Organization A cannot read Organization B Supplier', async () => {
    await expect(
      getSupplier(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        supplierId: supplierBId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Organization A cannot create a Purchase Order against Organization B Supplier', async () => {
    await expect(
      createPurchaseOrder(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        supplierId: supplierBId,
        receivingLocationId: locationAId,
        lineItems: [{ inventoryItemId: itemAId, quantityOrdered: '1', unitCost: '1.00' }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Organization A cannot create a Purchase Order receiving into Organization B Location', async () => {
    await expect(
      createPurchaseOrder(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        supplierId: supplierAId,
        receivingLocationId: locationBId,
        lineItems: [{ inventoryItemId: itemAId, quantityOrdered: '1', unitCost: '1.00' }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Organization A cannot read Organization B Purchase Order', async () => {
    const poB = await createPurchaseOrder(db, {
      organizationId: organizationBId,
      actorUserId: ownerB.id,
      supplierId: supplierBId,
      receivingLocationId: locationBId,
      lineItems: [],
    });
    await expect(
      getPurchaseOrder(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        purchaseOrderId: poB.purchaseOrder.id,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
