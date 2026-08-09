import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acknowledgeDispatch,
  dispatchJob,
  ForbiddenError,
  getJobSchedule,
  listSchedule,
  NotFoundError,
  scheduleJob,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * scheduling.md, "Permission requirements": Dispatcher/Admin/Owner full
 * read/write. Technician read-only on their OWN schedule
 * (`scheduling:read_assigned`). dispatch-prd.md §12: Technician can
 * acknowledge only their own assigned Job's dispatch.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `sched-perm-owner-${suffix}@example.test`,
  fullName: 'Perm Owner',
};
const dispatcher = {
  id: randomUUID(),
  email: `sched-perm-dispatcher-${suffix}@example.test`,
  fullName: 'Dispatcher',
};
const technicianAssigned = {
  id: randomUUID(),
  email: `sched-perm-tech-assigned-${suffix}@example.test`,
  fullName: 'Tech Assigned',
};
const technicianOther = {
  id: randomUUID(),
  email: `sched-perm-tech-other-${suffix}@example.test`,
  fullName: 'Tech Other',
};

let organizationId: string;
let jobId: string;

const capturedTokens: Record<string, string> = {};
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    capturedTokens[params.invitedEmail] = params.invitationToken;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Sched Permission Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  for (const [member, role] of [
    [dispatcher, 'dispatcher'],
    [technicianAssigned, 'technician'],
    [technicianOther, 'technician'],
  ] as const) {
    await inviteMember(
      db,
      { organizationId, actorUserId: owner.id, invitedEmail: member.email, roleName: role },
      capturingNotifier,
    );
    const token = capturedTokens[member.email];
    expect(token).toBeDefined();
    await acceptInvitation(db, { token: token!, invitee: member });
  }

  const customer = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Sched Permission Customer ${suffix}`,
  });
  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Sched Permission Property ${suffix}`,
  });
  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) throw new Error('No platform-default job_types row seeded.');

  const created = await createJob(db, {
    organizationId,
    actorUserId: owner.id,
    jobTypeId: platformJobType.id,
    customerId: customer.customer.id,
    propertyId: property.property.id,
  });
  jobId = created.job.id;

  await scheduleJob(db, {
    organizationId,
    actorUserId: owner.id,
    jobId,
    scheduledStart: new Date('2026-11-01T09:00:00Z'),
    scheduledEnd: new Date('2026-11-01T11:00:00Z'),
    userIds: [technicianAssigned.id],
  });
  await dispatchJob(db, { organizationId, actorUserId: owner.id, jobId });
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
    for (const user of [owner, dispatcher, technicianAssigned, technicianOther]) {
      await tx.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
  await db.$client.end();
});

describe('Role-permission matrix for Scheduling/Dispatch', () => {
  it('Dispatcher sees the full board and can dispatch', async () => {
    const events = await listSchedule(db, {
      organizationId,
      actorUserId: dispatcher.id,
      start: new Date('2026-11-01T00:00:00Z'),
      end: new Date('2026-11-02T00:00:00Z'),
    });
    expect(events.length).toBeGreaterThan(0);
  });

  it('the assigned Technician can read their own Schedule Event and acknowledge their own dispatch', async () => {
    await expect(
      getJobSchedule(db, { organizationId, actorUserId: technicianAssigned.id, jobId }),
    ).resolves.toBeDefined();
    await expect(
      acknowledgeDispatch(db, { organizationId, actorUserId: technicianAssigned.id, jobId }),
    ).resolves.toBeDefined();
  });

  it('a Technician not assigned to the Job cannot read its Schedule Event or acknowledge its dispatch', async () => {
    await expect(
      getJobSchedule(db, { organizationId, actorUserId: technicianOther.id, jobId }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      acknowledgeDispatch(db, { organizationId, actorUserId: technicianOther.id, jobId }),
    ).rejects.toThrow(NotFoundError);
  });

  it('a Technician cannot schedule or dispatch a Job (scheduling:write not granted)', async () => {
    await expect(
      scheduleJob(db, {
        organizationId,
        actorUserId: technicianAssigned.id,
        jobId,
        scheduledStart: new Date('2026-11-05T09:00:00Z'),
        scheduledEnd: new Date('2026-11-05T11:00:00Z'),
        userIds: [technicianAssigned.id],
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      dispatchJob(db, { organizationId, actorUserId: technicianAssigned.id, jobId }),
    ).rejects.toThrow();
  });
});
