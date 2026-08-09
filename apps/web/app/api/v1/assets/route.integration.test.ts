import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createProperty } from '@atlas/properties';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';

/**
 * Real API-layer tests for /api/v1/assets — docs/09-testing/
 * api-testing.md. Mirrors apps/web/app/api/v1/customers/
 * route.integration.test.ts.
 */
const actor = {
  id: randomUUID(),
  email: `assets-api-test-owner-${Date.now()}@example.test`,
  fullName: 'Assets API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;
let propertyId: string;
let assetTypeId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `Assets API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;

  const property = await createProperty(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyType: 'commercial',
    addressLine1: 'Assets API Test Property',
  });
  propertyId = property.property.id;

  const [platformAssetType] = await withServiceContext(getDb(), (tx) =>
    tx.select().from(schema.assetTypes).where(isNull(schema.assetTypes.organizationId)).limit(1),
  );
  if (!platformAssetType) {
    throw new Error('No platform-default asset_types row seeded — see migration 0013.');
  }
  assetTypeId = platformAssetType.id;
});

afterAll(async () => {
  await withServiceContext(getDb(), async (tx) => {
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
    await tx.delete(schema.users).where(eq(schema.users.id, actor.id));
  });
});

describe('POST /api/v1/assets', () => {
  it('creates an Asset and returns 201', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/assets', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          property_id: propertyId,
          asset_type_id: assetTypeId,
          manufacturer_name: 'API Test Manufacturer',
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as {
      data: { id: string; manufacturer_name: string; status: string };
    };

    expect(response.status).toBe(201);
    expect(body.data.manufacturer_name).toBe('API Test Manufacturer');
    expect(body.data.status).toBe('active');
  });

  it('returns 404 not_found when property_id belongs to no accessible Property', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/assets', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          property_id: randomUUID(),
          asset_type_id: assetTypeId,
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('not_found');
  });

  it('returns 422 validation_error for an invalid payload', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/assets', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
      }),
      undefined,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('validation_error');
  });
});

describe('GET /api/v1/assets', () => {
  it('lists Assets scoped to a Property with the documented pagination envelope', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(
        `http://localhost/api/v1/assets?organization_id=${organizationId}&property_id=${propertyId}&limit=25`,
      ),
      undefined,
    );
    const body = (await response.json()) as {
      data: unknown[];
      meta: { has_more: boolean; next_cursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.has_more).toBe('boolean');
  });

  it('returns 400 when organization_id is missing', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/v1/assets'), undefined);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('bad_request');
  });
});
