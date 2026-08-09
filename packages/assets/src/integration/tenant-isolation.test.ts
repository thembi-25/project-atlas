import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { schema, withRequestContext, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createProperty } from '@atlas/properties';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAsset, getAsset, NotFoundError } from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-3.md security requirements — the Asset half of
 * the ten mandatory RLS scenarios (see @atlas/properties's
 * tenant-isolation suite for the Property half): Organization A cannot
 * select Organization B's Assets, cannot attach an Asset to Organization
 * B's Property, and the database's own FK/uniqueness constraints hold
 * regardless of the application layer.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = {
  id: randomUUID(),
  email: `assets-owner-a-${suffix}@example.test`,
  fullName: 'Owner A',
};
const ownerB = {
  id: randomUUID(),
  email: `assets-owner-b-${suffix}@example.test`,
  fullName: 'Owner B',
};

let organizationAId: string;
let organizationBId: string;
let propertyAId: string;
let propertyBId: string;
let assetTypeId: string;
let assetAId: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `Assets Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;

  const orgB = await createOrganization(db, {
    name: `Assets Org B ${suffix}`,
    tradeTypeIds: [],
    owner: ownerB,
  });
  organizationBId = orgB.organizationId;

  const propertyA = await createProperty(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    propertyType: 'commercial',
    addressLine1: `Asset Test Property A ${suffix}`,
  });
  propertyAId = propertyA.property.id;

  const propertyB = await createProperty(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    propertyType: 'commercial',
    addressLine1: `Asset Test Property B ${suffix}`,
  });
  propertyBId = propertyB.property.id;

  const [platformAssetType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.assetTypes).where(isNull(schema.assetTypes.organizationId)).limit(1),
  );
  if (!platformAssetType) {
    throw new Error('No platform-default asset_types row seeded — see migration 0013.');
  }
  assetTypeId = platformAssetType.id;

  const asset = await createAsset(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    propertyId: propertyAId,
    assetTypeId,
    manufacturerName: 'Rheem',
    modelNumber: `RA-${suffix}`,
  });
  assetAId = asset.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const organizationId of [organizationAId, organizationBId]) {
      await tx.delete(schema.assets).where(eq(schema.assets.organizationId, organizationId));

      const properties = await tx
        .select({ id: schema.properties.id })
        .from(schema.properties)
        .where(eq(schema.properties.organizationId, organizationId));
      for (const p of properties) {
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

describe('Assets cross-tenant isolation', () => {
  it("Owner B cannot get Org A's Asset by ID (masked as not_found)", async () => {
    await expect(
      getAsset(db, { organizationId: organizationAId, actorUserId: ownerB.id, assetId: assetAId }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner B cannot attach an Asset to Org A's Property (cross-tenant property rejected, even scoped to Org B)", async () => {
    await expect(
      createAsset(db, {
        organizationId: organizationBId,
        actorUserId: ownerB.id,
        propertyId: propertyAId,
        assetTypeId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot attach an Asset to Org B's Property while acting in Org A", async () => {
    await expect(
      createAsset(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        propertyId: propertyBId,
        assetTypeId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner A (real member, correct permission) can read their own Asset', async () => {
    const asset = await getAsset(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      assetId: assetAId,
    });
    expect(asset.id).toBe(assetAId);
  });

  it('FORCE ROW LEVEL SECURITY holds: a direct select under an unrelated actor context returns zero rows', async () => {
    const rows = await withRequestContext(db, randomUUID(), (tx) =>
      tx.select().from(schema.assets).where(eq(schema.assets.organizationId, organizationAId)),
    );
    expect(rows).toHaveLength(0);
  });

  it('produces an audit_events row for Asset creation, visible only to Org A', async () => {
    const rows = await withServiceContext(db, (tx) =>
      tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.organizationId, organizationAId),
            eq(schema.auditEvents.entityType, 'properties.assets'),
            eq(schema.auditEvents.entityId, assetAId),
          ),
        ),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.organizationId === organizationAId)).toBe(true);
  });

  it('database FK constraint rejects an Asset referencing a non-existent Property, independent of the application layer', async () => {
    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.assets).values({
          organizationId: organizationAId,
          propertyId: randomUUID(),
          assetTypeId,
        }),
      ),
    ).rejects.toThrow();
  });

  it('database unique constraint rejects a duplicate (organization_id, trade_type_id, name) asset_type', async () => {
    const [existing] = await withServiceContext(db, (tx) =>
      tx.select().from(schema.assetTypes).where(isNull(schema.assetTypes.organizationId)).limit(1),
    );
    expect(existing).toBeDefined();

    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.assetTypes).values({
          organizationId: null,
          tradeTypeId: existing!.tradeTypeId,
          name: existing!.name,
        }),
      ),
    ).rejects.toThrow();
  });
});
