import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';

/**
 * Real API-layer tests for /api/v1/inventory-items — docs/09-testing/api-testing.md.
 * Mirrors apps/web/app/api/v1/estimates/route.integration.test.ts.
 */
const actor = {
  id: randomUUID(),
  email: `inventory-items-api-test-owner-${Date.now()}@example.test`,
  fullName: 'Inventory Items API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `Inventory Items API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;
});

afterAll(async () => {
  await withServiceContext(getDb(), async (tx) => {
    await tx
      .delete(schema.inventoryItems)
      .where(eq(schema.inventoryItems.organizationId, organizationId));
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

describe('POST /api/v1/inventory-items', () => {
  it('creates an Inventory Item and returns 201', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/inventory-items', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          sku: `API-TEST-${Date.now()}`,
          description: '1/2" Copper Fitting',
          unit_cost: 3.5,
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as {
      data: { id: string; sku: string; unit_cost: string };
    };

    expect(response.status).toBe(201);
    expect(body.data.unit_cost).toBe('3.50');
  });

  it('returns 422 validation_error for an invalid payload', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/inventory-items', {
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

describe('GET /api/v1/inventory-items', () => {
  it('lists Inventory Items for the Organization', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(`http://localhost/api/v1/inventory-items?organization_id=${organizationId}`),
      undefined,
    );
    const body = (await response.json()) as { data: unknown[] };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 400 bad_request without organization_id', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/v1/inventory-items'), undefined);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('bad_request');
  });
});
