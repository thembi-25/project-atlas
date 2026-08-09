import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { schema, withRequestContext, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCustomer } from '@atlas/crm';
import {
  addCustomerAssociation,
  createProperty,
  getProperty,
  listProperties,
  NotFoundError,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-3.md security requirements: Organization A
 * cannot select/update/delete Organization B's Properties, nor associate
 * its Properties with another Organization's Customers. See
 * docs/07-security/tenant-isolation.md, docs/09-testing/
 * integration-testing.md. This is Sprint 3's Properties half of the ten
 * mandatory RLS scenarios; see @atlas/assets's tenant-isolation suite for
 * the Asset half (attach-to-foreign-Property, FK, uniqueness, audit).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = {
  id: randomUUID(),
  email: `properties-owner-a-${suffix}@example.test`,
  fullName: 'Owner A',
};
const ownerB = {
  id: randomUUID(),
  email: `properties-owner-b-${suffix}@example.test`,
  fullName: 'Owner B',
};

let organizationAId: string;
let organizationBId: string;
let propertyAId: string;
let customerBId: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `Properties Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;

  const orgB = await createOrganization(db, {
    name: `Properties Org B ${suffix}`,
    tradeTypeIds: [],
    owner: ownerB,
  });
  organizationBId = orgB.organizationId;

  const property = await createProperty(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    propertyType: 'residential_single_family',
    addressLine1: `100 Org A St ${suffix}`,
  });
  propertyAId = property.property.id;

  const customerB = await createCustomer(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    type: 'residential',
    displayName: `Org B Customer ${suffix}`,
  });
  customerBId = customerB.customer.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const organizationId of [organizationAId, organizationBId]) {
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
      await tx
        .delete(schema.properties)
        .where(eq(schema.properties.organizationId, organizationId));

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
        await tx
          .delete(schema.membershipRoles)
          .where(eq(schema.membershipRoles.membershipId, m.id));
      }
      await tx
        .delete(schema.organizationMemberships)
        .where(eq(schema.organizationMemberships.organizationId, organizationId));
      await tx.delete(schema.organizations).where(eq(schema.organizations.id, organizationId));
    }
    await tx.delete(schema.users).where(eq(schema.users.id, ownerA.id));
    await tx.delete(schema.users).where(eq(schema.users.id, ownerB.id));
  });
  await db.$client.end();
});

describe('Properties cross-tenant isolation', () => {
  it("Owner B cannot get Org A's Property by ID (masked as not_found)", async () => {
    await expect(
      getProperty(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        propertyId: propertyAId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner B sees zero Properties when listing Org A (no active Membership at all)', async () => {
    await expect(
      listProperties(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        limit: 25,
        sortField: 'created_at',
        sortDirection: 'desc',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner B cannot create a Property in Org A', async () => {
    await expect(
      createProperty(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        propertyType: 'residential_single_family',
        addressLine1: 'Intruder Property',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot associate Org A's Property with Org B's Customer (cross-tenant association rejected)", async () => {
    await expect(
      addCustomerAssociation(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        propertyId: propertyAId,
        customerId: customerBId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner A (real member of Org A, correct permission) can read their own Property', async () => {
    const property = await getProperty(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      propertyId: propertyAId,
    });
    expect(property.id).toBe(propertyAId);
  });

  it('FORCE ROW LEVEL SECURITY holds: a direct select under an unrelated actor context returns zero rows', async () => {
    const rows = await withRequestContext(db, randomUUID(), (tx) =>
      tx
        .select()
        .from(schema.properties)
        .where(eq(schema.properties.organizationId, organizationAId)),
    );
    expect(rows).toHaveLength(0);
  });

  it('produces an audit_events row for Property creation, visible only to Org A', async () => {
    const rows = await withServiceContext(db, (tx) =>
      tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.organizationId, organizationAId),
            eq(schema.auditEvents.entityType, 'properties.properties'),
            eq(schema.auditEvents.entityId, propertyAId),
          ),
        ),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.organizationId === organizationAId)).toBe(true);
    expect(rows.some((row) => row.action === 'create')).toBe(true);
  });

  it('the auto-provisioned default Building belongs to Org A only', async () => {
    const buildings = await withServiceContext(db, (tx) =>
      tx
        .select()
        .from(schema.buildings)
        .where(
          and(eq(schema.buildings.propertyId, propertyAId), isNull(schema.buildings.deletedAt)),
        ),
    );
    expect(buildings).toHaveLength(1);
    expect(buildings[0]?.organizationId).toBe(organizationAId);
    expect(buildings[0]?.name).toBe('Main House');
  });
});
