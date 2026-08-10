import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob, assignUserToJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adjustStock,
  consumePart,
  createInventoryItem,
  createInventoryLocation,
  ForbiddenError,
  listInventoryItems,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/03-domain/permissions.md/docs/03-domain/roles.md: a single
 * combined `inventory` resource — Owner/Admin: `read`+`write`+`consume`
 * (full). Dispatcher: `read` only. Technician: `read`+`consume`,
 * restricted to assigned Jobs. Accountant/Read Only: `read` only.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `inv-perm-owner-${suffix}@example.test`,
  fullName: 'Owner',
};
const dispatcher = {
  id: randomUUID(),
  email: `inv-perm-dispatcher-${suffix}@example.test`,
  fullName: 'Dispatcher',
};
const technician = {
  id: randomUUID(),
  email: `inv-perm-tech-${suffix}@example.test`,
  fullName: 'Technician',
};
const otherTechnician = {
  id: randomUUID(),
  email: `inv-perm-tech2-${suffix}@example.test`,
  fullName: 'Other Technician',
};

let organizationId: string;
let jobId: string;
let itemId: string;
let locationId: string;

const capturedTokens: Record<string, string> = {};
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    capturedTokens[params.invitedEmail] = params.invitationToken;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Inv Permission Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  for (const [member, role] of [
    [dispatcher, 'dispatcher'],
    [technician, 'technician'],
    [otherTechnician, 'technician'],
  ] as const) {
    await inviteMember(
      db,
      { organizationId, actorUserId: owner.id, invitedEmail: member.email, roleName: role },
      capturingNotifier,
    );
    const token = capturedTokens[member.email];
    expect(token).toBeDefined();
    await acceptInvitation(db, { token: token!, invitee: member });
  }

  const customer = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Inv Permission Customer ${suffix}`,
  });
  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Inv Permission Property ${suffix}`,
  });
  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) throw new Error('No platform-default job_types row seeded.');

  const job = await createJob(db, {
    organizationId,
    actorUserId: owner.id,
    jobTypeId: platformJobType.id,
    customerId: customer.customer.id,
    propertyId: property.property.id,
  });
  jobId = job.job.id;
  await assignUserToJob(db, {
    organizationId,
    actorUserId: owner.id,
    jobId,
    userId: technician.id,
  });

  const item = await createInventoryItem(db, {
    organizationId,
    actorUserId: owner.id,
    sku: `PERM-${suffix}`,
    description: 'Permission test item',
    unitCost: '5.00',
  });
  itemId = item.id;
  const location = await createInventoryLocation(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'warehouse',
    name: `Perm Warehouse ${suffix}`,
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
    await tx
      .delete(schema.jobAssignments)
      .where(eq(schema.jobAssignments.organizationId, organizationId));
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
    for (const user of [owner, dispatcher, technician, otherTechnician]) {
      await tx.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
  await db.$client.end();
});

describe('Role-permission matrix for Inventory', () => {
  it('Dispatcher can read but not write Inventory Items', async () => {
    await expect(
      listInventoryItems(db, {
        organizationId,
        actorUserId: dispatcher.id,
        limit: 10,
        sortField: 'created_at',
        sortDirection: 'desc',
      }),
    ).resolves.toBeDefined();

    await expect(
      createInventoryItem(db, {
        organizationId,
        actorUserId: dispatcher.id,
        sku: `DISPATCHER-${suffix}`,
        description: 'Dispatcher attempt',
        unitCost: '1.00',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Technician can consume parts on an assigned Job but not adjust Inventory Item master data', async () => {
    const result = await consumePart(db, {
      organizationId,
      actorUserId: technician.id,
      jobId,
      inventoryItemId: itemId,
      locationId,
      quantity: '1',
    });
    expect(result.jobPart.consumedByUserId).toBe(technician.id);

    await expect(
      adjustStock(db, {
        organizationId,
        actorUserId: technician.id,
        inventoryItemId: itemId,
        locationId,
        reason: 'received',
        quantityDelta: '5',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('a Technician not assigned to the Job cannot consume parts on it', async () => {
    await expect(
      consumePart(db, {
        organizationId,
        actorUserId: otherTechnician.id,
        jobId,
        inventoryItemId: itemId,
        locationId,
        quantity: '1',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Owner has full read/write/consume access', async () => {
    const movement = await adjustStock(db, {
      organizationId,
      actorUserId: owner.id,
      inventoryItemId: itemId,
      locationId,
      reason: 'received',
      quantityDelta: '10',
    });
    expect(movement.reason).toBe('received');
  });
});
