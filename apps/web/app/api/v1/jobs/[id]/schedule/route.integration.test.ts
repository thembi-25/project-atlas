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
 * Real API-layer tests for POST/PATCH /api/v1/jobs/{id}/schedule and
 * POST /api/v1/jobs/{id}/dispatch — docs/09-testing/api-testing.md.
 */
const actor = {
  id: randomUUID(),
  email: `schedule-api-test-owner-${Date.now()}@example.test`,
  fullName: 'Schedule API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;
let jobId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `Schedule API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;

  const customer = await createCustomer(getDb(), {
    organizationId,
    actorUserId: actor.id,
    type: 'residential',
    displayName: 'Schedule API Test Customer',
  });
  const property = await createProperty(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyType: 'commercial',
    addressLine1: 'Schedule API Test Property',
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
      .delete(schema.dispatchEvents)
      .where(eq(schema.dispatchEvents.organizationId, organizationId));
    await tx
      .delete(schema.scheduleEventAssignments)
      .where(eq(schema.scheduleEventAssignments.organizationId, organizationId));
    await tx
      .delete(schema.scheduleEvents)
      .where(eq(schema.scheduleEvents.organizationId, organizationId));
    await tx.delete(schema.tasks).where(eq(schema.tasks.organizationId, organizationId));
    await tx
      .delete(schema.jobStatusHistory)
      .where(eq(schema.jobStatusHistory.organizationId, organizationId));
    await tx.delete(schema.jobs).where(eq(schema.jobs.organizationId, organizationId));
    await tx
      .delete(schema.jobNumberCounters)
      .where(eq(schema.jobNumberCounters.organizationId, organizationId));

    const properties = await tx
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(eq(schema.properties.organizationId, organizationId));
    for (const p of properties) {
      await tx.delete(schema.buildings).where(eq(schema.buildings.propertyId, p.id));
    }
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

describe('POST /api/v1/jobs/{id}/schedule', () => {
  it('schedules the Job and transitions it to scheduled', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request(`http://localhost/api/v1/jobs/${jobId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          scheduled_start: '2026-12-01T09:00:00.000Z',
          scheduled_end: '2026-12-01T11:00:00.000Z',
          user_ids: [actor.id],
        }),
      }),
      { params: { id: jobId } },
    );
    const body = (await response.json()) as {
      data: { schedule_event: { id: string }; conflicts: unknown[] };
    };

    expect(response.status).toBe(201);
    expect(body.data.schedule_event.id).toBeDefined();
    expect(Array.isArray(body.data.conflicts)).toBe(true);
  });
});

describe('POST /api/v1/jobs/{id}/dispatch', () => {
  it('dispatches the scheduled Job', async () => {
    const { POST } = await import('../dispatch/route');
    const response = await POST(
      new Request(`http://localhost/api/v1/jobs/${jobId}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
      }),
      { params: { id: jobId } },
    );
    const body = (await response.json()) as { data: { job: { status: string } } };

    expect(response.status).toBe(200);
    expect(body.data.job.status).toBe('dispatched');
  });

  it('returns 409 conflict when dispatching a non-scheduled Job', async () => {
    const { POST } = await import('../dispatch/route');
    const response = await POST(
      new Request(`http://localhost/api/v1/jobs/${jobId}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
      }),
      { params: { id: jobId } },
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('conflict');
  });
});
