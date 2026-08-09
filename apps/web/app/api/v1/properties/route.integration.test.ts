import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';

/**
 * Real API-layer tests for /api/v1/properties — docs/09-testing/
 * api-testing.md: exercised against the actual route handlers and a real
 * database. Only session/cookie resolution is stubbed — Permission
 * checks, RLS, and tenant isolation all run for real against Postgres.
 * Mirrors apps/web/app/api/v1/customers/route.integration.test.ts.
 */
const actor = {
  id: randomUUID(),
  email: `properties-api-test-owner-${Date.now()}@example.test`,
  fullName: 'Properties API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `Properties API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;
});

afterAll(async () => {
  await withServiceContext(getDb(), async (tx) => {
    const properties = await tx
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(eq(schema.properties.organizationId, organizationId));
    for (const p of properties) {
      await tx
        .delete(schema.propertyCustomerAssociations)
        .where(eq(schema.propertyCustomerAssociations.propertyId, p.id));
      await tx.delete(schema.buildings).where(eq(schema.buildings.propertyId, p.id));
    }
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

describe('POST /api/v1/properties', () => {
  it('creates a Property (auto-provisioning a default Building) and returns 201', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/properties', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          property_type: 'residential_single_family',
          address_line1: '123 API Test St',
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as {
      data: { property: { id: string; address_line1: string }; default_building_id: string | null };
    };

    expect(response.status).toBe(201);
    expect(body.data.property.address_line1).toBe('123 API Test St');
    expect(body.data.default_building_id).toBeTruthy();
  });

  it('returns 422 validation_error for an invalid payload', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/properties', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, property_type: 'not-a-real-type' }),
      }),
      undefined,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('validation_error');
  });
});

describe('GET /api/v1/properties', () => {
  it('lists Properties with the documented pagination envelope', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(`http://localhost/api/v1/properties?organization_id=${organizationId}&limit=1`),
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
    const response = await GET(new Request('http://localhost/api/v1/properties'), undefined);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('bad_request');
  });
});
