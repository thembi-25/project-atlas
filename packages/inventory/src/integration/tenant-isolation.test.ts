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
  listInventoryItems,
  NotFoundError,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-6.md security requirements — the mandatory
 * RLS/tenant-isolation scenarios, adapted for Inventory Items/Locations/
 * Stock Movements/Job Parts, mirroring @atlas/financials's identical
 * suite from Sprint 5.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = {
  id: randomUUID(),
  email: `inv-owner-a-${suffix}@example.test`,
  fullName: 'Owner A',
};
const ownerB = {
  id: randomUUID(),
  email: `inv-owner-b-${suffix}@example.test`,
  fullName: 'Owner B',
};

let organizationAId: string;
let organizationBId: string;
let jobAId: string;
let jobTypeId: string;
let itemAId: string;
let itemBId: string;
let locationAId: string;
let locationBId: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `Inv Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;
  const orgB = await createOrganization(db, {
    name: `Inv Org B ${suffix}`,
    tradeTypeIds: [],
    owner: ownerB,
  });
  organizationBId = orgB.organizationId;

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) throw new Error('No platform-default job_types row seeded.');
  jobTypeId = platformJobType.id;

  const customerA = await createCustomer(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    type: 'residential',
    displayName: `Inv Customer A ${suffix}`,
  });
  const propertyA = await createProperty(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    propertyType: 'commercial',
    addressLine1: `Inv Property A ${suffix}`,
  });
  const jobA = await createJob(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    jobTypeId,
    customerId: customerA.customer.id,
    propertyId: propertyA.property.id,
  });
  jobAId = jobA.job.id;

  const itemA = await createInventoryItem(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    sku: `SKU-A-${suffix}`,
    description: 'Item A',
    unitCost: '10.00',
  });
  itemAId = itemA.id;
  const itemB = await createInventoryItem(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    sku: `SKU-B-${suffix}`,
    description: 'Item B',
    unitCost: '10.00',
  });
  itemBId = itemB.id;

  const locationA = await createInventoryLocation(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    type: 'warehouse',
    name: `Warehouse A ${suffix}`,
  });
  locationAId = locationA.id;
  const locationB = await createInventoryLocation(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    type: 'warehouse',
    name: `Warehouse B ${suffix}`,
  });
  locationBId = locationB.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const orgId of [organizationAId, organizationBId]) {
      await tx.delete(schema.jobParts).where(eq(schema.jobParts.organizationId, orgId));
      await tx.delete(schema.stockMovements).where(eq(schema.stockMovements.organizationId, orgId));
      await tx.delete(schema.inventoryItems).where(eq(schema.inventoryItems.organizationId, orgId));
      await tx
        .delete(schema.inventoryLocations)
        .where(eq(schema.inventoryLocations.organizationId, orgId));
    }
    await tx.delete(schema.tasks).where(eq(schema.tasks.organizationId, organizationAId));
    await tx
      .delete(schema.jobStatusHistory)
      .where(eq(schema.jobStatusHistory.organizationId, organizationAId));
    await tx.delete(schema.jobs).where(eq(schema.jobs.organizationId, organizationAId));
    await tx
      .delete(schema.jobNumberCounters)
      .where(eq(schema.jobNumberCounters.organizationId, organizationAId));
    await tx.delete(schema.properties).where(eq(schema.properties.organizationId, organizationAId));
    await tx.delete(schema.customers).where(eq(schema.customers.organizationId, organizationAId));
    for (const orgId of [organizationAId, organizationBId]) {
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

describe('Inventory tenant isolation', () => {
  it('Organization A cannot read Organization B Inventory Item', async () => {
    await expect(
      getInventoryItem(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        inventoryItemId: itemBId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Organization A cannot adjust stock on Organization B Inventory Item', async () => {
    await expect(
      adjustStock(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        inventoryItemId: itemBId,
        locationId: locationAId,
        reason: 'received',
        quantityDelta: '5',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Organization A cannot adjust stock against Organization B Location', async () => {
    await expect(
      adjustStock(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        inventoryItemId: itemAId,
        locationId: locationBId,
        reason: 'received',
        quantityDelta: '5',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Organization A cannot consume a Job Part sourced from Organization B Inventory Item', async () => {
    await expect(
      consumePart(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        jobId: jobAId,
        inventoryItemId: itemBId,
        locationId: locationAId,
        quantity: '1',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Organization A cannot consume a Job Part against Organization B Location', async () => {
    await expect(
      consumePart(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        jobId: jobAId,
        inventoryItemId: itemAId,
        locationId: locationBId,
        quantity: '1',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Organization A listing Inventory Items never returns Organization B rows', async () => {
    const { rows } = await listInventoryItems(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      limit: 100,
      sortField: 'created_at',
      sortDirection: 'desc',
    });
    expect(rows.every((r) => r.organizationId === organizationAId)).toBe(true);
    expect(rows.some((r) => r.id === itemBId)).toBe(false);
  });

  it('a caller with no Membership in the target Organization is rejected as not-found, not forbidden', async () => {
    const stranger = randomUUID();
    await expect(
      getInventoryItem(db, {
        organizationId: organizationAId,
        actorUserId: stranger,
        inventoryItemId: itemAId,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
