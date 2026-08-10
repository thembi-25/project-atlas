import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createInventoryItem, createInventoryLocation } from '@atlas/inventory';
import { createSupplier } from '@atlas/suppliers';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';

/**
 * Real API-layer tests for /api/v1/purchase-orders — docs/09-testing/api-testing.md.
 * Mirrors apps/web/app/api/v1/estimates/route.integration.test.ts.
 */
const actor = {
  id: randomUUID(),
  email: `purchase-orders-api-test-owner-${Date.now()}@example.test`,
  fullName: 'Purchase Orders API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;
let supplierId: string;
let locationId: string;
let inventoryItemId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `Purchase Orders API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;

  const supplier = await createSupplier(getDb(), {
    organizationId,
    actorUserId: actor.id,
    name: 'API Test Supplier',
  });
  supplierId = supplier.id;

  const location = await createInventoryLocation(getDb(), {
    organizationId,
    actorUserId: actor.id,
    type: 'warehouse',
    name: 'API Test Warehouse',
  });
  locationId = location.id;

  const item = await createInventoryItem(getDb(), {
    organizationId,
    actorUserId: actor.id,
    sku: `PO-API-TEST-${Date.now()}`,
    description: 'API Test Item',
    unitCost: '4.00',
  });
  inventoryItemId = item.id;
});

afterAll(async () => {
  await withServiceContext(getDb(), async (tx) => {
    await tx
      .delete(schema.purchaseOrderLineItems)
      .where(eq(schema.purchaseOrderLineItems.organizationId, organizationId));
    await tx
      .delete(schema.purchaseOrders)
      .where(eq(schema.purchaseOrders.organizationId, organizationId));
    await tx.delete(schema.suppliers).where(eq(schema.suppliers.organizationId, organizationId));
    await tx
      .delete(schema.inventoryItems)
      .where(eq(schema.inventoryItems.organizationId, organizationId));
    await tx
      .delete(schema.inventoryLocations)
      .where(eq(schema.inventoryLocations.organizationId, organizationId));
    const memberships = await tx
      .select({ id: schema.organizationMemberships.id })
      .from(schema.organizationMemberships)
      .where(eq(schema.organizationMemberships.organizationId, organizationId));
    for (const m of memberships) {
      await tx.delete(schema.membershipRoles).where(eq(schema.membershipRoles.membershipId, m.id));
    }
    await tx
      .delete(schema.organizationMemberships)
      .where(eq(schema.organizationMemberships.organizationId, organizationId));
    await tx.delete(schema.organizations).where(eq(schema.organizations.id, organizationId));
    await tx.delete(schema.users).where(eq(schema.users.id, actor.id));
  });
});

describe('POST /api/v1/purchase-orders', () => {
  it('creates a draft Purchase Order with line items and returns 201', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          supplier_id: supplierId,
          receiving_location_id: locationId,
          line_items: [{ inventory_item_id: inventoryItemId, quantity_ordered: 5, unit_cost: 4 }],
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as {
      data: { purchase_order: { id: string; status: string }; line_items: unknown[] };
    };

    expect(response.status).toBe(201);
    expect(body.data.purchase_order.status).toBe('draft');
    expect(body.data.line_items).toHaveLength(1);
  });

  it('returns 404 not_found when supplier_id belongs to no accessible Supplier', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          supplier_id: randomUUID(),
          receiving_location_id: locationId,
          line_items: [{ inventory_item_id: inventoryItemId, quantity_ordered: 1, unit_cost: 1 }],
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('not_found');
  });

  it('returns 422 validation_error for an invalid payload', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
      }),
      undefined,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('validation_error');
  });
});

describe('GET /api/v1/purchase-orders', () => {
  it('lists Purchase Orders for the Organization', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(`http://localhost/api/v1/purchase-orders?organization_id=${organizationId}`),
      undefined,
    );
    const body = (await response.json()) as { data: unknown[] };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
