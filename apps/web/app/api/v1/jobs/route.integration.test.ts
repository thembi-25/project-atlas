import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';

/**
 * Real API-layer tests for /api/v1/jobs — docs/09-testing/api-testing.md.
 * Mirrors apps/web/app/api/v1/properties/route.integration.test.ts.
 */
const actor = {
  id: randomUUID(),
  email: `jobs-api-test-owner-${Date.now()}@example.test`,
  fullName: 'Jobs API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;
let customerId: string;
let propertyId: string;
let jobTypeId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `Jobs API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;

  const customer = await createCustomer(getDb(), {
    organizationId,
    actorUserId: actor.id,
    type: 'residential',
    displayName: 'Jobs API Test Customer',
  });
  customerId = customer.customer.id;

  const property = await createProperty(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyType: 'commercial',
    addressLine1: 'Jobs API Test Property',
  });
  propertyId = property.property.id;

  const [platformJobType] = await withServiceContext(getDb(), (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) {
    throw new Error('No platform-default job_types row seeded — see migration 0018.');
  }
  jobTypeId = platformJobType.id;
});

afterAll(async () => {
  await withServiceContext(getDb(), async (tx) => {
    await tx.delete(schema.tasks).where(eq(schema.tasks.organizationId, organizationId));
    await tx
      .delete(schema.jobStatusHistory)
      .where(eq(schema.jobStatusHistory.organizationId, organizationId));
    await tx.delete(schema.jobs).where(eq(schema.jobs.organizationId, organizationId));
    await tx
      .delete(schema.jobNumberCounters)
      .where(eq(schema.jobNumberCounters.organizationId, organizationId));
    await tx.delete(schema.properties).where(eq(schema.properties.organizationId, organizationId));
    await tx.delete(schema.contacts).where(eq(schema.contacts.customerId, customerId));
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

describe('POST /api/v1/jobs', () => {
  it('creates a Job and returns 201', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/jobs', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          job_type_id: jobTypeId,
          customer_id: customerId,
          property_id: propertyId,
          description: 'API test job',
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as { data: { job: { id: string; status: string } } };

    expect(response.status).toBe(201);
    expect(body.data.job.status).toBe('draft');
  });

  it('returns 404 not_found when property_id belongs to no accessible Property', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/jobs', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          job_type_id: jobTypeId,
          customer_id: customerId,
          property_id: randomUUID(),
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
      new Request('http://localhost/api/v1/jobs', {
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

describe('GET /api/v1/jobs', () => {
  it('lists Jobs with the documented pagination envelope', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(`http://localhost/api/v1/jobs?organization_id=${organizationId}&limit=25`),
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
    const response = await GET(new Request('http://localhost/api/v1/jobs'), undefined);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('bad_request');
  });
});
