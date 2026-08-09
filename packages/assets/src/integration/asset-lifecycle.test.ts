import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createBuilding, createProperty, createRoom } from '@atlas/properties';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  archiveAsset,
  createAsset,
  getAsset,
  InvalidAssetStateError,
  restoreAsset,
  searchAssets,
  transitionAssetStatus,
  updateAsset,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * Full Asset lifecycle: assets.md business rules 1-4 and the
 * active -> removed/decommissioned one-way status transition
 * (assets-prd.md §9).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `assets-lifecycle-owner-${suffix}@example.test`,
  fullName: 'Lifecycle Owner',
};

let organizationId: string;
let propertyId: string;
let buildingId: string;
let roomId: string;
let assetTypeId: string;

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Assets Lifecycle Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Lifecycle Property ${suffix}`,
  });
  propertyId = property.property.id;

  const building = await createBuilding(db, {
    organizationId,
    actorUserId: owner.id,
    propertyId,
    name: `Lifecycle Building ${suffix}`,
  });
  buildingId = building.id;

  const room = await createRoom(db, {
    organizationId,
    actorUserId: owner.id,
    buildingId,
    name: `Mechanical Room ${suffix}`,
  });
  roomId = room.id;

  const [platformAssetType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.assetTypes).where(isNull(schema.assetTypes.organizationId)).limit(1),
  );
  if (!platformAssetType) {
    throw new Error('No platform-default asset_types row seeded — see migration 0013.');
  }
  assetTypeId = platformAssetType.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    await tx.delete(schema.assets).where(eq(schema.assets.organizationId, organizationId));
    await tx.delete(schema.rooms).where(eq(schema.rooms.buildingId, buildingId));
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
  });
  await db.$client.end();
});

describe('Asset creation with precise location', () => {
  it('creates an Asset located at Property > Building > Room', async () => {
    const asset = await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      buildingId,
      roomId,
      assetTypeId,
      manufacturerName: 'Bradford White',
      modelNumber: `BW-${suffix}`,
      serialNumber: `SN-${suffix}`,
    });
    expect(asset.propertyId).toBe(propertyId);
    expect(asset.buildingId).toBe(buildingId);
    expect(asset.roomId).toBe(roomId);
    expect(asset.status).toBe('active');
  });

  it('creates an Asset at the Property level with no Building/Room (rooms.md business rule 1: precision is optional)', async () => {
    const asset = await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      assetTypeId,
    });
    expect(asset.buildingId).toBeNull();
    expect(asset.roomId).toBeNull();
  });
});

describe('status lifecycle — assets.md business rules 2/3', () => {
  it('transitions active -> decommissioned and keeps the record visible', async () => {
    const asset = await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      assetTypeId,
    });

    const decommissioned = await transitionAssetStatus(db, {
      organizationId,
      actorUserId: owner.id,
      assetId: asset.id,
      status: 'decommissioned',
    });
    expect(decommissioned.status).toBe('decommissioned');
    expect(decommissioned.deletedAt).toBeNull();

    const fetched = await getAsset(db, {
      organizationId,
      actorUserId: owner.id,
      assetId: asset.id,
    });
    expect(fetched.status).toBe('decommissioned');
  });

  it('rejects a transition out of a terminal status', async () => {
    const asset = await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      assetTypeId,
    });
    await transitionAssetStatus(db, {
      organizationId,
      actorUserId: owner.id,
      assetId: asset.id,
      status: 'removed',
    });

    await expect(
      transitionAssetStatus(db, {
        organizationId,
        actorUserId: owner.id,
        assetId: asset.id,
        status: 'decommissioned',
      }),
    ).rejects.toThrow(InvalidAssetStateError);
  });
});

describe('replace-Asset flow — assets-prd.md §18', () => {
  it('marks the old Asset removed and creates a new Asset, both retained', async () => {
    const original = await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      buildingId,
      roomId,
      assetTypeId,
      manufacturerName: 'Old Manufacturer',
    });

    const removed = await transitionAssetStatus(db, {
      organizationId,
      actorUserId: owner.id,
      assetId: original.id,
      status: 'removed',
    });
    expect(removed.status).toBe('removed');

    const replacement = await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      buildingId,
      roomId,
      assetTypeId,
      manufacturerName: 'New Manufacturer',
    });

    const stillVisible = await getAsset(db, {
      organizationId,
      actorUserId: owner.id,
      assetId: original.id,
    });
    expect(stillVisible.status).toBe('removed');
    expect(replacement.id).not.toBe(original.id);
    expect(replacement.status).toBe('active');
  });
});

describe('update, soft-delete, and restore', () => {
  it('updates ordinary fields without touching status or deleted_at', async () => {
    const asset = await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      assetTypeId,
    });
    const updated = await updateAsset(db, {
      organizationId,
      actorUserId: owner.id,
      assetId: asset.id,
      fields: { serialNumber: `UPDATED-${suffix}` },
    });
    expect(updated.serialNumber).toBe(`UPDATED-${suffix}`);
    expect(updated.status).toBe('active');
    expect(updated.deletedAt).toBeNull();
  });

  it('archives (soft-deletes) and restores an Asset', async () => {
    const asset = await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      assetTypeId,
    });
    const archived = await archiveAsset(db, {
      organizationId,
      actorUserId: owner.id,
      assetId: asset.id,
    });
    expect(archived.deletedAt).not.toBeNull();

    const restored = await restoreAsset(db, {
      organizationId,
      actorUserId: owner.id,
      assetId: asset.id,
    });
    expect(restored.deletedAt).toBeNull();
  });
});

describe('search', () => {
  it('finds an Asset by a fuzzy/partial manufacturer match', async () => {
    await createAsset(db, {
      organizationId,
      actorUserId: owner.id,
      propertyId,
      assetTypeId,
      manufacturerName: `Searchable Furnace Co ${suffix}`,
    });

    const hits = await searchAssets(db, {
      organizationId,
      actorUserId: owner.id,
      query: 'Searchable Furnace',
      limit: 10,
    });

    expect(hits.some((hit) => hit.asset.manufacturerName?.includes('Searchable Furnace'))).toBe(
      true,
    );
  });
});
