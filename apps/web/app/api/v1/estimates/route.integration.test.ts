import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';

/**
 * Real API-layer tests for /api/v1/estimates — docs/09-testing/api-testing.md.
 * Mirrors apps/web/app/api/v1/jobs/route.integration.test.ts.
 */
const actor = {
  id: randomUUID(),
  email: `estimates-api-test-owner-${Date.now()}@example.test`,
  fullName: 'Estimates API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;
let jobId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `Estimates API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;

  const customer = await createCustomer(getDb(), {
    organizationId,
    actorUserId: actor.id,
    type: 'residential',
    displayName: 'Estimates API Test Customer',
  });

  const property = await createProperty(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyType: 'commercial',
    addressLine1: 'Estimates API Test Property',
  });

  const [platformJobType] = await withServiceContext(getDb(), (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) {
    throw new Error('No platform-default job_types row seeded — see migration 0018.');
  }

  const job = await createJob(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobTypeId: platformJobType.id,
    customerId: customer.customer.id,
    propertyId: property.property.id,
  });
  jobId = job.job.id;
});

afterAll(async () => {
  await withServiceContext(getDb(), async (tx) => {
    await tx
      .delete(schema.estimateLineItems)
      .where(eq(schema.estimateLineItems.organizationId, organizationId));
    await tx.delete(schema.estimates).where(eq(schema.estimates.organizationId, organizationId));
    await tx
      .delete(schema.estimateNumberCounters)
      .where(eq(schema.estimateNumberCounters.organizationId, organizationId));
    await tx.delete(schema.tasks).where(eq(schema.tasks.organizationId, organizationId));
    await tx
      .delete(schema.jobStatusHistory)
      .where(eq(schema.jobStatusHistory.organizationId, organizationId));
    await tx.delete(schema.jobs).where(eq(schema.jobs.organizationId, organizationId));
    await tx
      .delete(schema.jobNumberCounters)
      .where(eq(schema.jobNumberCounters.organizationId, organizationId));
    await tx.delete(schema.properties).where(eq(schema.properties.organizationId, organizationId));
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

describe('POST /api/v1/estimates', () => {
  it('creates an Estimate with computed totals and returns 201', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/estimates', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          job_id: jobId,
          line_items: [
            { description: 'Diagnostic', quantity: 1, unit_price: 89.99 },
            { description: 'Part', quantity: 2, unit_price: 20 },
          ],
        }),
      }),
      undefined,
    );
    const body = (await response.json()) as {
      data: { estimate: { id: string; status: string; total: string } };
    };

    expect(response.status).toBe(201);
    expect(body.data.estimate.status).toBe('draft');
    expect(body.data.estimate.total).toBe('129.99');
  });

  it('returns 404 not_found when job_id belongs to no accessible Job', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/v1/estimates', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          job_id: randomUUID(),
          line_items: [{ description: 'Diagnostic', quantity: 1, unit_price: 50 }],
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
      new Request('http://localhost/api/v1/estimates', {
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

describe('GET /api/v1/estimates', () => {
  it('lists Estimates for the Organization', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(`http://localhost/api/v1/estimates?organization_id=${organizationId}`),
      undefined,
    );
    const body = (await response.json()) as { data: unknown[] };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 400 bad_request without organization_id', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/v1/estimates'), undefined);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('bad_request');
  });
});
