import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { archiveJob, createJob, ForbiddenError, getJob, NotFoundError, updateJob } from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/03-domain/jobs.md, "Permission requirements": Dispatcher/Admin/
 * Owner full read/write (not delete for Dispatcher — see migration
 * 0002_seed_platform_data.sql's role grants). Technician
 * read_assigned/write_assigned only. Accountant read-only.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `jobs-perm-owner-${suffix}@example.test`,
  fullName: 'Perm Owner',
};

interface RoleMember {
  role: string;
  user: { id: string; email: string; fullName: string };
}

const roleMembers: RoleMember[] = [
  {
    role: 'dispatcher',
    user: {
      id: randomUUID(),
      email: `jobs-dispatcher-${suffix}@example.test`,
      fullName: 'Dispatcher',
    },
  },
  {
    role: 'technician',
    user: {
      id: randomUUID(),
      email: `jobs-technician-${suffix}@example.test`,
      fullName: 'Technician',
    },
  },
  {
    role: 'accountant',
    user: {
      id: randomUUID(),
      email: `jobs-accountant-${suffix}@example.test`,
      fullName: 'Accountant',
    },
  },
];

let organizationId: string;
let customerId: string;
let propertyId: string;
let jobTypeId: string;
let sharedJobId: string;

const capturedTokens: Record<string, string> = {};
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    capturedTokens[params.invitedEmail] = params.invitationToken;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Jobs Permission Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  for (const member of roleMembers) {
    await inviteMember(
      db,
      {
        organizationId,
        actorUserId: owner.id,
        invitedEmail: member.user.email,
        roleName: member.role,
      },
      capturingNotifier,
    );
    const token = capturedTokens[member.user.email];
    expect(token).toBeDefined();
    await acceptInvitation(db, { token: token!, invitee: member.user });
  }

  const customer = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Jobs Permission Customer ${suffix}`,
  });
  customerId = customer.customer.id;

  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Jobs Permission Property ${suffix}`,
  });
  propertyId = property.property.id;

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType)
    throw new Error('No platform-default job_types row seeded — see migration 0018.');
  jobTypeId = platformJobType.id;

  const created = await createJob(db, {
    organizationId,
    actorUserId: owner.id,
    jobTypeId,
    customerId,
    propertyId,
  });
  sharedJobId = created.job.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
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
    for (const member of roleMembers) {
      await tx.delete(schema.users).where(eq(schema.users.id, member.user.id));
    }
  });
  await db.$client.end();
});

describe('Role-permission matrix for Jobs', () => {
  it('Dispatcher can read and write, but not archive, a Job', async () => {
    const dispatcher = roleMembers.find((m) => m.role === 'dispatcher')!;
    await expect(
      getJob(db, { organizationId, actorUserId: dispatcher.user.id, jobId: sharedJobId }),
    ).resolves.toBeDefined();
    await expect(
      updateJob(db, {
        organizationId,
        actorUserId: dispatcher.user.id,
        jobId: sharedJobId,
        fields: { description: 'Dispatcher update' },
      }),
    ).resolves.toBeDefined();
    await expect(
      archiveJob(db, { organizationId, actorUserId: dispatcher.user.id, jobId: sharedJobId }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Technician cannot see or write a Job they are not assigned to (masked as not_found)', async () => {
    const technician = roleMembers.find((m) => m.role === 'technician')!;
    await expect(
      getJob(db, { organizationId, actorUserId: technician.user.id, jobId: sharedJobId }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      updateJob(db, {
        organizationId,
        actorUserId: technician.user.id,
        jobId: sharedJobId,
        fields: { description: 'Should not work' },
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Technician can create a Job (jobs:write not granted — jobs:read_assigned/write_assigned only)', async () => {
    const technician = roleMembers.find((m) => m.role === 'technician')!;
    await expect(
      createJob(db, {
        organizationId,
        actorUserId: technician.user.id,
        jobTypeId,
        customerId,
        propertyId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Accountant can read but not write a Job', async () => {
    const accountant = roleMembers.find((m) => m.role === 'accountant')!;
    await expect(
      getJob(db, { organizationId, actorUserId: accountant.user.id, jobId: sharedJobId }),
    ).resolves.toBeDefined();
    await expect(
      updateJob(db, {
        organizationId,
        actorUserId: accountant.user.id,
        jobId: sharedJobId,
        fields: { description: 'Should not work' },
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner (full jobs:delete) can archive the Job', async () => {
    await expect(
      archiveJob(db, { organizationId, actorUserId: owner.id, jobId: sharedJobId }),
    ).resolves.toBeDefined();
  });
});
