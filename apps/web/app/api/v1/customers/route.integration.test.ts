import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';

/**
 * Real API-layer tests for /api/v1/customers — docs/09-testing/
 * api-testing.md: exercised against the actual route handlers and a real
 * database. Only session/cookie resolution is stubbed (`getAuthenticatedUser`
 * returns a fixed, real test User) — Permission checks, RLS, and tenant
 * isolation all run for real against Postgres; this is not "faking RLS
 * with mocked authorization" (docs/13-roadmap/sprint-2.md warns against
 * that), only bypassing cookie-session plumbing already covered by
 * Sprint 1's own tests.
 */
const actor = {
  id: randomUUID(),
  email: `api-test-owner-${Date.now()}@example.test`,
  fullName: 'API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;
});

afterAll(async () => {
  await withServiceContext(getDb(), async (tx) => {
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
      await tx.delete(schema.membershipRoles).where(eq(schema.membershipRoles.membershipId, m.id));
    }
    await tx
      .delete(schema.organizationMemberships)
      .where(eq(schema.organizationMemberships.organizationId, organizationId));
    await tx.delete(schema.organizations).where(eq(schema.organizations.id, organizationId));
    await tx.delete(schema.users).where(eq(schema.users.id, actor.id));
  });
});

describe('POST /api/v1/customers', () => {
  it('creates a Customer and returns 201 with the documented envelope', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          type: 'residential',
          display_name: 'API Test Customer',
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as {
      data: { customer: { id: string; display_name: string }; primary_contact_id: string };
    };

    expect(response.status).toBe(201);
    expect(body.data.customer.display_name).toBe('API Test Customer');
    expect(body.data.primary_contact_id).toBeTruthy();
  });

  it('returns 422 validation_error for an invalid payload', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, type: 'not-a-real-type' }),
      }),
      undefined,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('validation_error');
  });
});

describe('GET /api/v1/customers', () => {
  it('lists Customers with the documented pagination envelope', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(`http://localhost/api/v1/customers?organization_id=${organizationId}&limit=1`),
      undefined,
    );
    const body = (await response.json()) as {
      data: unknown[];
      meta: { has_more: boolean; next_cursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
    expect(typeof body.meta.has_more).toBe('boolean');
  });

  it('returns 400 when organization_id is missing', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/v1/customers'), undefined);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('bad_request');
  });

  it('returns 422 for an unsupported sort field', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(
        `http://localhost/api/v1/customers?organization_id=${organizationId}&sort=not_a_field`,
      ),
      undefined,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('validation_error');
  });
});
