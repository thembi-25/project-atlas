import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  archiveProperty,
  createProperty,
  ForbiddenError,
  getProperty,
  updateProperty,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/03-domain/properties.md, "Permission requirements": Dispatcher,
 * Admin, Owner: read/write. Technician: read-only. Accountant: read-only.
 * Exercises the seeded identity.role_permissions matrix end to end
 * (application layer + RLS) for every Role that holds a `properties`
 * Permission.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `properties-perm-owner-${suffix}@example.test`,
  fullName: 'Perm Owner',
};

interface RoleMember {
  role: string;
  user: { id: string; email: string; fullName: string };
}

const roleMembers: RoleMember[] = [
  {
    role: 'dispatcher',
    user: {
      id: randomUUID(),
      email: `properties-dispatcher-${suffix}@example.test`,
      fullName: 'Dispatcher',
    },
  },
  {
    role: 'technician',
    user: {
      id: randomUUID(),
      email: `properties-technician-${suffix}@example.test`,
      fullName: 'Technician',
    },
  },
  {
    role: 'accountant',
    user: {
      id: randomUUID(),
      email: `properties-accountant-${suffix}@example.test`,
      fullName: 'Accountant',
    },
  },
];

let organizationId: string;
let sharedPropertyId: string;

const capturedTokens: Record<string, string> = {};
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    capturedTokens[params.invitedEmail] = params.invitationToken;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Properties Permission Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  for (const member of roleMembers) {
    await inviteMember(
      db,
      {
        organizationId,
        actorUserId: owner.id,
        invitedEmail: member.user.email,
        roleName: member.role,
      },
      capturingNotifier,
    );
    const token = capturedTokens[member.user.email];
    expect(token).toBeDefined();
    await acceptInvitation(db, { token: token!, invitee: member.user });
  }

  const created = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Shared Property ${suffix}`,
  });
  sharedPropertyId = created.property.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    const buildings = await tx
      .select({ id: schema.buildings.id })
      .from(schema.buildings)
      .where(eq(schema.buildings.propertyId, sharedPropertyId));
    for (const b of buildings) {
      await tx.delete(schema.rooms).where(eq(schema.rooms.buildingId, b.id));
    }
    await tx.delete(schema.buildings).where(eq(schema.buildings.propertyId, sharedPropertyId));
    await tx
      .delete(schema.propertyCustomerAssociations)
      .where(eq(schema.propertyCustomerAssociations.propertyId, sharedPropertyId));
    await tx.delete(schema.properties).where(eq(schema.properties.organizationId, organizationId));

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
    for (const member of roleMembers) {
      await tx.delete(schema.users).where(eq(schema.users.id, member.user.id));
    }
  });
  await db.$client.end();
});

describe('Role-permission matrix for Properties', () => {
  it('Dispatcher can read and write, but not delete, a Property', async () => {
    const dispatcher = roleMembers.find((m) => m.role === 'dispatcher')!;
    await expect(
      getProperty(db, {
        organizationId,
        actorUserId: dispatcher.user.id,
        propertyId: sharedPropertyId,
      }),
    ).resolves.toBeDefined();
    await expect(
      updateProperty(db, {
        organizationId,
        actorUserId: dispatcher.user.id,
        propertyId: sharedPropertyId,
        fields: { accessNotes: 'Dispatcher note' },
      }),
    ).resolves.toBeDefined();
    await expect(
      archiveProperty(db, {
        organizationId,
        actorUserId: dispatcher.user.id,
        propertyId: sharedPropertyId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Technician can read but not write a Property', async () => {
    const technician = roleMembers.find((m) => m.role === 'technician')!;
    await expect(
      getProperty(db, {
        organizationId,
        actorUserId: technician.user.id,
        propertyId: sharedPropertyId,
      }),
    ).resolves.toBeDefined();
    await expect(
      updateProperty(db, {
        organizationId,
        actorUserId: technician.user.id,
        propertyId: sharedPropertyId,
        fields: { accessNotes: 'Technician note' },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Accountant can read but not write a Property', async () => {
    const accountant = roleMembers.find((m) => m.role === 'accountant')!;
    await expect(
      getProperty(db, {
        organizationId,
        actorUserId: accountant.user.id,
        propertyId: sharedPropertyId,
      }),
    ).resolves.toBeDefined();
    await expect(
      updateProperty(db, {
        organizationId,
        actorUserId: accountant.user.id,
        propertyId: sharedPropertyId,
        fields: { accessNotes: 'Should not work' },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Owner (full properties:delete) can archive the Property', async () => {
    await expect(
      archiveProperty(db, { organizationId, actorUserId: owner.id, propertyId: sharedPropertyId }),
    ).resolves.toBeDefined();
  });
});
