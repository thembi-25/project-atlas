import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acknowledgeDispatch,
  dispatchJob,
  markArrived,
  markEnRoute,
  rescheduleJob,
  RescheduleReasonRequiredError,
  scheduleJob,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * Full Scheduling + Dispatch flow — scheduling.md business rules 1-3,
 * dispatch.md business rules 1-4. Conflict detection specifically
 * verifies the documented "warn, not block" behavior
 * (scheduling.md business rule 2 / scheduling-prd.md §18's acceptance
 * criterion).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `sched-flow-owner-${suffix}@example.test`,
  fullName: 'Flow Owner',
};
const technicianUserId = randomUUID();

let organizationId: string;
let customerId: string;
let propertyId: string;
let jobTypeId: string;

async function makeJob() {
  const job = await createJob(db, {
    organizationId,
    actorUserId: owner.id,
    jobTypeId,
    customerId,
    propertyId,
  });
  return job.job.id;
}

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Sched Flow Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  // technicianUserId is used only as a target for `userIds` in schedule/conflict tests — it never needs
  // its own Membership because the actor driving every call here is always `owner` (has scheduling:write),
  // and Owner-tier grants org-wide visibility over the resulting Schedule Events regardless of assignee.
  await withServiceContext(db, (tx) =>
    tx
      .insert(schema.users)
      .values({
        id: technicianUserId,
        email: `sched-flow-tech-${suffix}@example.test`,
        fullName: 'Tech',
      }),
  );
  await withServiceContext(db, async (tx) => {
    const [role] = await tx
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.name, 'technician'))
      .limit(1);
    const [membership] = await tx
      .insert(schema.organizationMemberships)
      .values({ organizationId, userId: technicianUserId, status: 'active' })
      .returning();
    if (role && membership) {
      await tx
        .insert(schema.membershipRoles)
        .values({ membershipId: membership.id, roleId: role.id });
    }
  });

  const customer = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Sched Flow Customer ${suffix}`,
  });
  customerId = customer.customer.id;
  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Sched Flow Property ${suffix}`,
  });
  propertyId = property.property.id;

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) throw new Error('No platform-default job_types row seeded.');
  jobTypeId = platformJobType.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    await tx
      .delete(schema.dispatchEvents)
      .where(eq(schema.dispatchEvents.organizationId, organizationId));
    await tx
      .delete(schema.scheduleEventAssignments)
      .where(eq(schema.scheduleEventAssignments.organizationId, organizationId));
    await tx
      .delete(schema.scheduleEventHistory)
      .where(eq(schema.scheduleEventHistory.organizationId, organizationId));
    await tx
      .delete(schema.scheduleEvents)
      .where(eq(schema.scheduleEvents.organizationId, organizationId));
    await tx.delete(schema.tasks).where(eq(schema.tasks.organizationId, organizationId));
    await tx
      .delete(schema.jobStatusHistory)
      .where(eq(schema.jobStatusHistory.organizationId, organizationId));
    await tx
      .delete(schema.jobAssignments)
      .where(eq(schema.jobAssignments.organizationId, organizationId));
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
    await tx.delete(schema.users).where(eq(schema.users.id, owner.id));
    await tx.delete(schema.users).where(eq(schema.users.id, technicianUserId));
  });
  await db.$client.end();
});

describe('scheduleJob', () => {
  it('transitions a draft Job to scheduled and creates a Schedule Event', async () => {
    const jobId = await makeJob();
    const result = await scheduleJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      scheduledStart: new Date('2026-10-01T09:00:00Z'),
      scheduledEnd: new Date('2026-10-01T11:00:00Z'),
      userIds: [technicianUserId],
    });
    expect(result.job.status).toBe('scheduled');
    expect(result.conflicts).toHaveLength(0);
  });

  it('warns on, but does not block, an overlapping double-booking for the same Technician (scheduling.md business rule 2)', async () => {
    const jobId1 = await makeJob();
    await scheduleJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId: jobId1,
      scheduledStart: new Date('2026-10-02T09:00:00Z'),
      scheduledEnd: new Date('2026-10-02T11:00:00Z'),
      userIds: [technicianUserId],
    });

    const jobId2 = await makeJob();
    const result2 = await scheduleJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId: jobId2,
      scheduledStart: new Date('2026-10-02T10:00:00Z'),
      scheduledEnd: new Date('2026-10-02T12:00:00Z'),
      userIds: [technicianUserId],
    });
    expect(result2.job.status).toBe('scheduled');
    expect(result2.conflicts.length).toBeGreaterThan(0);
  });
});

describe('rescheduleJob', () => {
  it('requires a reason to reschedule a dispatched Job', async () => {
    const jobId = await makeJob();
    await scheduleJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      scheduledStart: new Date('2026-10-03T09:00:00Z'),
      scheduledEnd: new Date('2026-10-03T11:00:00Z'),
      userIds: [technicianUserId],
    });
    await dispatchJob(db, { organizationId, actorUserId: owner.id, jobId });

    await expect(
      rescheduleJob(db, {
        organizationId,
        actorUserId: owner.id,
        jobId,
        scheduledStart: new Date('2026-10-03T13:00:00Z'),
        scheduledEnd: new Date('2026-10-03T15:00:00Z'),
      }),
    ).rejects.toThrow(RescheduleReasonRequiredError);

    const result = await rescheduleJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      scheduledStart: new Date('2026-10-03T13:00:00Z'),
      scheduledEnd: new Date('2026-10-03T15:00:00Z'),
      reason: 'Technician running late on prior job',
    });
    expect(result.scheduleEvent.scheduledStart.toISOString()).toBe('2026-10-03T13:00:00.000Z');
  });
});

describe('dispatchJob + acknowledge/en-route/arrived', () => {
  it('runs the full dispatch -> acknowledge -> en-route -> arrived sequence', async () => {
    const jobId = await makeJob();
    await scheduleJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      scheduledStart: new Date('2026-10-04T09:00:00Z'),
      scheduledEnd: new Date('2026-10-04T11:00:00Z'),
      userIds: [technicianUserId],
    });
    const dispatchResult = await dispatchJob(db, { organizationId, actorUserId: owner.id, jobId });
    expect(dispatchResult.job.status).toBe('dispatched');
    expect(dispatchResult.dispatchEvent.dispatchedAt).toBeInstanceOf(Date);

    const acknowledged = await acknowledgeDispatch(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
    });
    expect(acknowledged.acknowledgedAt).toBeInstanceOf(Date);
    const enRoute = await markEnRoute(db, { organizationId, actorUserId: owner.id, jobId });
    expect(enRoute.enRouteAt).toBeInstanceOf(Date);
    const arrived = await markArrived(db, { organizationId, actorUserId: owner.id, jobId });
    expect(arrived.arrivedAt).toBeInstanceOf(Date);
  });

  it('rejects dispatching a Job that is not scheduled', async () => {
    const jobId = await makeJob();
    await expect(
      dispatchJob(db, { organizationId, actorUserId: owner.id, jobId }),
    ).rejects.toThrow();
  });
});
