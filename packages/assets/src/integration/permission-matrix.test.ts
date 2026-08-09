import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { createProperty } from '@atlas/properties';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { archiveAsset, createAsset, ForbiddenError, getAsset, updateAsset } from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/03-domain/assets.md, "Permission requirements" + migration
 * 0011_properties_technician_assets_write.sql: Dispatcher/Admin/Owner
 * read/write; Accountant read-only; Technician read **and write**
 * (assets-prd.md §12 — the one deliberate divergence from Properties'
 * own Technician-read-only rule).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `assets-perm-owner-${suffix}@example.test`,
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
      email: `assets-dispatcher-${suffix}@example.test`,
      fullName: 'Dispatcher',
    },
  },
  {
    role: 'technician',
    user: {
      id: randomUUID(),
      email: `assets-technician-${suffix}@example.test`,
      fullName: 'Technician',
    },
  },
  {
    role: 'accountant',
    user: {
      id: randomUUID(),
      email: `assets-accountant-${suffix}@example.test`,
      fullName: 'Accountant',
    },
  },
];

let organizationId: string;
let propertyId: string;
let assetTypeId: string;
let sharedAssetId: string;

const capturedTokens: Record<string, string> = {};
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    capturedTokens[params.invitedEmail] = params.invitationToken;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Assets Permission Org ${suffix}`,
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

  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Assets Permission Property ${suffix}`,
  });
  propertyId = property.property.id;

  const [platformAssetType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.assetTypes).where(isNull(schema.assetTypes.organizationId)).limit(1),
  );
  if (!platformAssetType) {
    throw new Error('No platform-default asset_types row seeded — see migration 0013.');
  }
  assetTypeId = platformAssetType.id;

  const created = await createAsset(db, {
    organizationId,
    actorUserId: owner.id,
    propertyId,
    assetTypeId,
  });
  sharedAssetId = created.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    await tx.delete(schema.assets).where(eq(schema.assets.organizationId, organizationId));
    await tx.delete(schema.buildings).where(eq(schema.buildings.propertyId, propertyId));
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

describe('Role-permission matrix for Assets', () => {
  it('Dispatcher can read and write, but not delete, an Asset', async () => {
    const dispatcher = roleMembers.find((m) => m.role === 'dispatcher')!;
    await expect(
      getAsset(db, { organizationId, actorUserId: dispatcher.user.id, assetId: sharedAssetId }),
    ).resolves.toBeDefined();
    await expect(
      updateAsset(db, {
        organizationId,
        actorUserId: dispatcher.user.id,
        assetId: sharedAssetId,
        fields: { serialNumber: 'Dispatcher Serial' },
      }),
    ).resolves.toBeDefined();
    await expect(
      archiveAsset(db, { organizationId, actorUserId: dispatcher.user.id, assetId: sharedAssetId }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Technician can read AND write an Asset (the documented Properties/Assets divergence)', async () => {
    const technician = roleMembers.find((m) => m.role === 'technician')!;
    await expect(
      getAsset(db, { organizationId, actorUserId: technician.user.id, assetId: sharedAssetId }),
    ).resolves.toBeDefined();
    await expect(
      updateAsset(db, {
        organizationId,
        actorUserId: technician.user.id,
        assetId: sharedAssetId,
        fields: { serialNumber: 'Technician Serial' },
      }),
    ).resolves.toBeDefined();
    await expect(
      archiveAsset(db, { organizationId, actorUserId: technician.user.id, assetId: sharedAssetId }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Accountant can read but not write an Asset', async () => {
    const accountant = roleMembers.find((m) => m.role === 'accountant')!;
    await expect(
      getAsset(db, { organizationId, actorUserId: accountant.user.id, assetId: sharedAssetId }),
    ).resolves.toBeDefined();
    await expect(
      updateAsset(db, {
        organizationId,
        actorUserId: accountant.user.id,
        assetId: sharedAssetId,
        fields: { serialNumber: 'Should not work' },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Owner (full assets:delete) can archive the Asset', async () => {
    await expect(
      archiveAsset(db, { organizationId, actorUserId: owner.id, assetId: sharedAssetId }),
    ).resolves.toBeDefined();
  });
});
