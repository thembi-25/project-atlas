import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withRequestContext, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCustomer, getCustomer, listContacts, listCustomers, NotFoundError } from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-2.md security requirements: Organization A
 * cannot select/update/delete Organization B's Customers or Contacts.
 * See docs/07-security/tenant-isolation.md, docs/09-testing/
 * integration-testing.md.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = {
  id: randomUUID(),
  email: `crm-owner-a-${suffix}@example.test`,
  fullName: 'Owner A',
};
const ownerB = {
  id: randomUUID(),
  email: `crm-owner-b-${suffix}@example.test`,
  fullName: 'Owner B',
};

let organizationAId: string;
let organizationBId: string;
let customerAId: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `CRM Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;

  const orgB = await createOrganization(db, {
    name: `CRM Org B ${suffix}`,
    tradeTypeIds: [],
    owner: ownerB,
  });
  organizationBId = orgB.organizationId;

  const created = await createCustomer(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    type: 'residential',
    displayName: `Org A Customer ${suffix}`,
  });
  customerAId = created.customer.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const organizationId of [organizationAId, organizationBId]) {
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

describe('CRM cross-tenant isolation', () => {
  it("Owner B cannot get Org A's Customer by ID (masked as not_found)", async () => {
    await expect(
      getCustomer(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        customerId: customerAId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner B sees zero Customers when listing Org A (no active Membership at all)', async () => {
    await expect(
      listCustomers(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        limit: 25,
        sortField: 'created_at',
        sortDirection: 'desc',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner B cannot create a Customer in Org A', async () => {
    await expect(
      createCustomer(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        type: 'residential',
        displayName: 'Intruder Customer',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner B cannot list Contacts for Org A's Customer", async () => {
    await expect(
      listContacts(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        customerId: customerAId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner A (real member of Org A, correct permission) can read their own Customer', async () => {
    const customer = await getCustomer(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      customerId: customerAId,
    });
    expect(customer.id).toBe(customerAId);
  });

  it('FORCE ROW LEVEL SECURITY holds: a direct select under an unrelated actor context returns zero rows', async () => {
    const rows = await withRequestContext(db, randomUUID(), (tx) =>
      tx
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.organizationId, organizationAId)),
    );
    expect(rows).toHaveLength(0);
  });
});
