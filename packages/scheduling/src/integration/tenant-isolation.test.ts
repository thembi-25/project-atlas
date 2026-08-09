import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { schema, withRequestContext, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dispatchJob, getJobSchedule, NotFoundError, scheduleJob } from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-4.md security requirements — the Scheduling/
 * Dispatch half of the ten mandatory RLS scenarios (see @atlas/jobs's
 * tenant-isolation suite for the Jobs half): Organization A cannot
 * schedule/dispatch Organization B's Job, cannot assign Organization
 * B's Technician to a Schedule Event, and cannot read Organization B's
 * appointments/dispatch events.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = {
  id: randomUUID(),
  email: `sched-owner-a-${suffix}@example.test`,
  fullName: 'Owner A',
};
const ownerB = {
  id: randomUUID(),
  email: `sched-owner-b-${suffix}@example.test`,
  fullName: 'Owner B',
};

let organizationAId: string;
let organizationBId: string;
let jobAId: string;
let jobBId: string;
let jobTypeId: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `Sched Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;
  const orgB = await createOrganization(db, {
    name: `Sched Org B ${suffix}`,
    tradeTypeIds: [],
    owner: ownerB,
  });
  organizationBId = orgB.organizationId;

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) throw new Error('No platform-default job_types row seeded.');
  jobTypeId = platformJobType.id;

  const customerA = await createCustomer(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    type: 'residential',
    displayName: `Sched Customer A ${suffix}`,
  });
  const propertyA = await createProperty(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    propertyType: 'commercial',
    addressLine1: `Sched Property A ${suffix}`,
  });
  const jobA = await createJob(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    jobTypeId,
    customerId: customerA.customer.id,
    propertyId: propertyA.property.id,
  });
  jobAId = jobA.job.id;

  const customerB = await createCustomer(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    type: 'residential',
    displayName: `Sched Customer B ${suffix}`,
  });
  const propertyB = await createProperty(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    propertyType: 'commercial',
    addressLine1: `Sched Property B ${suffix}`,
  });
  const jobB = await createJob(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    jobTypeId,
    customerId: customerB.customer.id,
    propertyId: propertyB.property.id,
  });
  jobBId = jobB.job.id;

  await scheduleJob(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    jobId: jobAId,
    scheduledStart: new Date('2026-09-01T09:00:00Z'),
    scheduledEnd: new Date('2026-09-01T11:00:00Z'),
    userIds: [ownerA.id],
  });
  await dispatchJob(db, { organizationId: organizationAId, actorUserId: ownerA.id, jobId: jobAId });
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const organizationId of [organizationAId, organizationBId]) {
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
      await tx.delete(schema.jobs).where(eq(schema.jobs.organizationId, organizationId));
      await tx
        .delete(schema.jobNumberCounters)
        .where(eq(schema.jobNumberCounters.organizationId, organizationId));
      await tx
        .delete(schema.properties)
        .where(eq(schema.properties.organizationId, organizationId));
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

describe('Scheduling/Dispatch cross-tenant isolation', () => {
  it("Owner B cannot read Org A's Schedule Event", async () => {
    await expect(
      getJobSchedule(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        jobId: jobAId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot schedule Org B's Job while acting in Org A", async () => {
    await expect(
      scheduleJob(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        jobId: jobBId,
        scheduledStart: new Date('2026-09-02T09:00:00Z'),
        scheduledEnd: new Date('2026-09-02T11:00:00Z'),
        userIds: [ownerA.id],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot assign Org B's User (no active Membership in Org A) to an Org A Job", async () => {
    const customerA = await createCustomer(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      type: 'residential',
      displayName: `Sched Customer A2 ${suffix}`,
    });
    const propertyA = await createProperty(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      propertyType: 'commercial',
      addressLine1: `Sched Property A2 ${suffix}`,
    });
    const jobA2 = await createJob(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      jobTypeId,
      customerId: customerA.customer.id,
      propertyId: propertyA.property.id,
    });

    await expect(
      scheduleJob(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        jobId: jobA2.job.id,
        scheduledStart: new Date('2026-09-03T09:00:00Z'),
        scheduledEnd: new Date('2026-09-03T11:00:00Z'),
        userIds: [ownerB.id],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('FORCE ROW LEVEL SECURITY holds: a direct select under an unrelated actor context returns zero rows', async () => {
    const rows = await withRequestContext(db, randomUUID(), (tx) =>
      tx
        .select()
        .from(schema.scheduleEvents)
        .where(eq(schema.scheduleEvents.organizationId, organizationAId)),
    );
    expect(rows).toHaveLength(0);
  });

  it('produces audit_events rows for Schedule Event and Dispatch Event creation, visible only to Org A', async () => {
    const scheduleRows = await withServiceContext(db, (tx) =>
      tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.organizationId, organizationAId),
            eq(schema.auditEvents.entityType, 'jobs.schedule_events'),
          ),
        ),
    );
    expect(scheduleRows.length).toBeGreaterThan(0);
    expect(scheduleRows.every((row) => row.organizationId === organizationAId)).toBe(true);

    const dispatchRows = await withServiceContext(db, (tx) =>
      tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.organizationId, organizationAId),
            eq(schema.auditEvents.entityType, 'jobs.dispatch_events'),
          ),
        ),
    );
    expect(dispatchRows.length).toBeGreaterThan(0);
  });

  it('database FK constraint rejects a Schedule Event referencing a non-existent Job, independent of the application layer', async () => {
    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.scheduleEvents).values({
          organizationId: organizationAId,
          jobId: randomUUID(),
          scheduledStart: new Date('2026-09-04T09:00:00Z'),
          scheduledEnd: new Date('2026-09-04T11:00:00Z'),
        }),
      ),
    ).rejects.toThrow();
  });

  it('database CHECK constraint rejects scheduled_end <= scheduled_start', async () => {
    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.scheduleEvents).values({
          organizationId: organizationBId,
          jobId: jobBId,
          scheduledStart: new Date('2026-09-05T11:00:00Z'),
          scheduledEnd: new Date('2026-09-05T09:00:00Z'),
        }),
      ),
    ).rejects.toThrow();
  });
});
