import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adjustStock,
  consumePart,
  createInventoryItem,
  createInventoryLocation,
  getInventoryItem,
  getQuantityOnHand,
  updateInventoryItem,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * inventory-prd.md §18 acceptance criteria: "Given an Inventory Item with
 * 5 units at a truck location, when a Technician consumes 2 units on a
 * Job, then the location's derived quantity on hand becomes 3, and the
 * Job's cost reflects 2 x unit_cost_at_time." Plus inventory.md business
 * rule 3: a later cost change never rewrites historical Job costing, and
 * business rule 2: over-consuming warns rather than blocks.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `inv-lifecycle-owner-${suffix}@example.test`,
  fullName: 'Owner',
};

let organizationId: string;
let jobId: string;
let itemId: string;
let locationId: string;

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Inv Lifecycle Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) throw new Error('No platform-default job_types row seeded.');

  const customer = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Inv Lifecycle Customer ${suffix}`,
  });
  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Inv Lifecycle Property ${suffix}`,
  });
  const job = await createJob(db, {
    organizationId,
    actorUserId: owner.id,
    jobTypeId: platformJobType.id,
    customerId: customer.customer.id,
    propertyId: property.property.id,
  });
  jobId = job.job.id;

  const item = await createInventoryItem(db, {
    organizationId,
    actorUserId: owner.id,
    sku: `LIFECYCLE-${suffix}`,
    description: 'Widget',
    unitCost: '20.00',
  });
  itemId = item.id;

  const location = await createInventoryLocation(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'truck',
    name: `Truck ${suffix}`,
  });
  locationId = location.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    await tx.delete(schema.jobParts).where(eq(schema.jobParts.organizationId, organizationId));
    await tx
      .delete(schema.stockMovements)
      .where(eq(schema.stockMovements.organizationId, organizationId));
    await tx
      .delete(schema.inventoryItems)
      .where(eq(schema.inventoryItems.organizationId, organizationId));
    await tx
      .delete(schema.inventoryLocations)
      .where(eq(schema.inventoryLocations.organizationId, organizationId));
    await tx.delete(schema.tasks).where(eq(schema.tasks.organizationId, organizationId));
    await tx
      .delete(schema.jobStatusHistory)
      .where(eq(schema.jobStatusHistory.organizationId, organizationId));
    await tx.delete(schema.jobs).where(eq(schema.jobs.organizationId, organizationId));
    await tx
      .delete(schema.jobNumberCounters)
      .where(eq(schema.jobNumberCounters.organizationId, organizationId));
    await tx.delete(schema.properties).where(eq(schema.properties.organizationId, organizationId));
    await tx.delete(schema.customers).where(eq(schema.customers.organizationId, organizationId));
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
    await tx.delete(schema.users).where(eq(schema.users.id, owner.id));
  });
  await db.$client.end();
});

describe('Stock lifecycle: receive -> consume -> cost-at-time invariant', () => {
  it('receiving stock increases quantity on hand', async () => {
    await adjustStock(db, {
      organizationId,
      actorUserId: owner.id,
      inventoryItemId: itemId,
      locationId,
      reason: 'received',
      quantityDelta: '5',
    });
    const quantity = await withServiceContext(db, (tx) =>
      getQuantityOnHand(tx, { inventoryItemId: itemId, locationId }),
    );
    expect(quantity).toBe(5);
  });

  it('consuming 2 units brings quantity to 3 with no warning, capturing unit_cost_at_time', async () => {
    const result = await consumePart(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      inventoryItemId: itemId,
      locationId,
      quantity: '2',
    });
    expect(result.warning).toBeUndefined();
    expect(result.jobPart.unitCostAtTime).toBe('20.00');

    const quantity = await withServiceContext(db, (tx) =>
      getQuantityOnHand(tx, { inventoryItemId: itemId, locationId }),
    );
    expect(quantity).toBe(3);
  });

  it('a later unit_cost change on the Item does not retroactively alter the already-captured Job Part cost', async () => {
    await updateInventoryItem(db, {
      organizationId,
      actorUserId: owner.id,
      inventoryItemId: itemId,
      fields: { unitCost: '35.00' },
    });
    const { item } = await getInventoryItem(db, {
      organizationId,
      actorUserId: owner.id,
      inventoryItemId: itemId,
    });
    expect(item.unitCost).toBe('35.00');

    const result = await consumePart(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      inventoryItemId: itemId,
      locationId,
      quantity: '1',
    });
    expect(result.jobPart.unitCostAtTime).toBe('35.00');
  });

  it('consuming more than is on hand warns but does not block — inventory.md business rule 2', async () => {
    const quantityBefore = await withServiceContext(db, (tx) =>
      getQuantityOnHand(tx, { inventoryItemId: itemId, locationId }),
    );
    const result = await consumePart(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      inventoryItemId: itemId,
      locationId,
      quantity: String(quantityBefore + 10),
    });
    expect(result.warning).toBeDefined();
    const quantityAfter = await withServiceContext(db, (tx) =>
      getQuantityOnHand(tx, { inventoryItemId: itemId, locationId }),
    );
    expect(quantityAfter).toBe(quantityBefore - (quantityBefore + 10));
  });
});
