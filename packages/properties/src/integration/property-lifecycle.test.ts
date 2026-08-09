import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addCustomerAssociation,
  archiveBuilding,
  archiveProperty,
  createProperty,
  endCustomerAssociation,
  listBuildings,
  listCustomerAssociations,
  PossibleDuplicatePropertyError,
  PropertyHasActiveRecordsError,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * Full Property lifecycle: buildings.md business rule 1 (default Building
 * auto-provisioning), properties.md business rules 3/4 (duplicate
 * detection, delete-blocked-by-active-children), and
 * property_customer_associations add/end (properties.md business rule 1).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `properties-lifecycle-owner-${suffix}@example.test`,
  fullName: 'Lifecycle Owner',
};

let organizationId: string;

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Properties Lifecycle Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    const properties = await tx
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(eq(schema.properties.organizationId, organizationId));
    for (const p of properties) {
      await tx
        .delete(schema.propertyCustomerAssociations)
        .where(eq(schema.propertyCustomerAssociations.propertyId, p.id));
      const buildings = await tx
        .select({ id: schema.buildings.id })
        .from(schema.buildings)
        .where(eq(schema.buildings.propertyId, p.id));
      for (const b of buildings) {
        await tx.delete(schema.rooms).where(eq(schema.rooms.buildingId, b.id));
      }
      await tx.delete(schema.buildings).where(eq(schema.buildings.propertyId, p.id));
    }
    await tx.delete(schema.properties).where(eq(schema.properties.organizationId, organizationId));

    const customers = await tx
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.organizationId, organizationId));
    for (const c of customers) {
      await tx.delete(schema.contacts).where(eq(schema.contacts.customerId, c.id));
    }
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

describe('default Building provisioning — buildings.md business rule 1', () => {
  it('auto-provisions a single "Main House" Building for a single-family residential Property', async () => {
    const result = await createProperty(db, {
      organizationId,
      actorUserId: owner.id,
      propertyType: 'residential_single_family',
      addressLine1: `1 Main House Ln ${suffix}`,
    });
    expect(result.defaultBuilding).toBeDefined();
    expect(result.defaultBuilding?.name).toBe('Main House');

    const buildings = await listBuildings(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId: result.property.id,
    });
    expect(buildings).toHaveLength(1);
  });

  it('does not auto-provision a Building for a commercial Property', async () => {
    const result = await createProperty(db, {
      organizationId,
      actorUserId: owner.id,
      propertyType: 'commercial',
      addressLine1: `1 Commercial Plaza ${suffix}`,
    });
    expect(result.defaultBuilding).toBeUndefined();

    const buildings = await listBuildings(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId: result.property.id,
    });
    expect(buildings).toHaveLength(0);
  });
});

describe('duplicate address detection — properties.md business rule 3', () => {
  it('blocks creation of a near-duplicate address without acknowledgement (422-mapped error)', async () => {
    const addressLine1 = `42 Duplicate Way ${suffix}`;
    await createProperty(db, {
      organizationId,
      actorUserId: owner.id,
      propertyType: 'commercial',
      addressLine1,
      addressPostalCode: '90210',
    });

    await expect(
      createProperty(db, {
        organizationId,
        actorUserId: owner.id,
        propertyType: 'commercial',
        addressLine1,
        addressPostalCode: '90210',
      }),
    ).rejects.toThrow(PossibleDuplicatePropertyError);
  });

  it('allows creation of the same address when the duplicate is explicitly acknowledged', async () => {
    const addressLine1 = `43 Acknowledged Way ${suffix}`;
    await createProperty(db, {
      organizationId,
      actorUserId: owner.id,
      propertyType: 'commercial',
      addressLine1,
      addressPostalCode: '90211',
    });

    await expect(
      createProperty(db, {
        organizationId,
        actorUserId: owner.id,
        propertyType: 'commercial',
        addressLine1,
        addressPostalCode: '90211',
        acknowledgeDuplicate: true,
      }),
    ).resolves.toBeDefined();
  });
});

describe('delete blocked by active children — properties.md business rule 4', () => {
  it('blocks archiving a Property while its default Building is still active, then succeeds once archived', async () => {
    const result = await createProperty(db, {
      organizationId,
      actorUserId: owner.id,
      propertyType: 'residential_single_family',
      addressLine1: `2 Blocked Delete Ln ${suffix}`,
    });

    await expect(
      archiveProperty(db, {
        organizationId,
        actorUserId: owner.id,
        propertyId: result.property.id,
      }),
    ).rejects.toThrow(PropertyHasActiveRecordsError);

    await archiveBuilding(db, {
      organizationId,
      actorUserId: owner.id,
      buildingId: result.defaultBuilding!.id,
    });

    await expect(
      archiveProperty(db, {
        organizationId,
        actorUserId: owner.id,
        propertyId: result.property.id,
      }),
    ).resolves.toBeDefined();
  });
});

describe('property_customer_associations add/end — properties.md business rule 1', () => {
  it('ends the current association when a new one is added, and supports ending without a replacement', async () => {
    const property = await createProperty(db, {
      organizationId,
      actorUserId: owner.id,
      propertyType: 'commercial',
      addressLine1: `3 Association Ave ${suffix}`,
    });
    const customer1 = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Association Customer One ${suffix}`,
    });
    const customer2 = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Association Customer Two ${suffix}`,
    });

    const first = await addCustomerAssociation(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId: property.property.id,
      customerId: customer1.customer.id,
    });
    expect(first.effectiveTo).toBeNull();

    const second = await addCustomerAssociation(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId: property.property.id,
      customerId: customer2.customer.id,
    });
    expect(second.effectiveTo).toBeNull();

    const history = await listCustomerAssociations(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId: property.property.id,
    });
    const firstAfterUpdate = history.find((a) => a.id === first.id);
    expect(firstAfterUpdate?.effectiveTo).not.toBeNull();

    const ended = await endCustomerAssociation(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId: property.property.id,
      associationId: second.id,
    });
    expect(ended.effectiveTo).not.toBeNull();
  });
});
