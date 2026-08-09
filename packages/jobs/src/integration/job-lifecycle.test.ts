import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cancelJob,
  completeJob,
  createJob,
  holdJob,
  IncompleteRequiredTasksError,
  InvalidJobStateError,
  listTasks,
  resumeJob,
  startJob,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * Full Job lifecycle — jobs.md#state-machine and business rules 2-5:
 * default-checklist copy at creation, valid/invalid transitions, the
 * required-Task completion gate, and cancellation-requires-a-reason.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `jobs-lifecycle-owner-${suffix}@example.test`,
  fullName: 'Lifecycle Owner',
};

let organizationId: string;
let customerId: string;
let propertyId: string;
let jobTypeId: string;

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Jobs Lifecycle Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  const customer = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Lifecycle Customer ${suffix}`,
  });
  customerId = customer.customer.id;

  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Lifecycle Property ${suffix}`,
  });
  propertyId = property.property.id;

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType)
    throw new Error('No platform-default job_types row seeded — see migration 0018.');
  jobTypeId = platformJobType.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
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
    await tx.delete(schema.users).where(eq(schema.users.id, owner.id));
  });
  await db.$client.end();
});

describe('Job creation copies the default checklist', () => {
  it('copies the seeded checklist_template_items onto the Job as Tasks', async () => {
    const result = await createJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobTypeId,
      customerId,
      propertyId,
    });
    expect(result.taskCount).toBeGreaterThan(0);
    const tasks = await listTasks(db, {
      organizationId,
      actorUserId: owner.id,
      jobId: result.job.id,
    });
    expect(tasks.length).toBe(result.taskCount);
    expect(tasks[0]?.isRequired).toBe(true);
  });
});

describe('status lifecycle — jobs.md#state-machine', () => {
  it('rejects an undocumented transition (draft -> completed)', async () => {
    const { job } = await createJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobTypeId,
      customerId,
      propertyId,
    });
    await expect(
      completeJob(db, { organizationId, actorUserId: owner.id, jobId: job.id }),
    ).rejects.toThrow(InvalidJobStateError);
  });

  it('cancels a draft Job with a reason, and rejects a subsequent cancel (terminal)', async () => {
    const { job } = await createJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobTypeId,
      customerId,
      propertyId,
    });
    const cancelled = await cancelJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId: job.id,
      reason: 'Customer no longer needs service',
    });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('Customer no longer needs service');

    await expect(
      cancelJob(db, { organizationId, actorUserId: owner.id, jobId: job.id, reason: 'again' }),
    ).rejects.toThrow(InvalidJobStateError);
  });
});

describe('completion gating — jobs.md business rule 3', () => {
  it('blocks completion while a required Task is incomplete, then succeeds once done', async () => {
    const { job } = await withServiceContext(db, async () => {
      return createJob(db, {
        organizationId,
        actorUserId: owner.id,
        jobTypeId,
        customerId,
        propertyId,
      });
    });

    // Force the Job directly into in_progress for this test (bypassing Scheduling/Dispatch, which live in @atlas/scheduling — see that package's integration suite for the full flow).
    await withServiceContext(db, (tx) =>
      tx.update(schema.jobs).set({ status: 'in_progress' }).where(eq(schema.jobs.id, job.id)),
    );

    await expect(
      completeJob(db, { organizationId, actorUserId: owner.id, jobId: job.id }),
    ).rejects.toThrow(IncompleteRequiredTasksError);

    const tasks = await listTasks(db, { organizationId, actorUserId: owner.id, jobId: job.id });
    await withServiceContext(db, async (tx) => {
      for (const task of tasks) {
        await tx
          .update(schema.tasks)
          .set({ completedAt: new Date(), completedByUserId: owner.id })
          .where(eq(schema.tasks.id, task.id));
      }
    });

    const completed = await completeJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId: job.id,
    });
    expect(completed.status).toBe('completed');
  });
});

describe('in_progress <-> on_hold', () => {
  it('holds and resumes a Job', async () => {
    const { job } = await createJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobTypeId,
      customerId,
      propertyId,
    });
    await withServiceContext(db, (tx) =>
      tx.update(schema.jobs).set({ status: 'in_progress' }).where(eq(schema.jobs.id, job.id)),
    );
    const held = await holdJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobId: job.id,
      reason: 'Parts needed',
    });
    expect(held.status).toBe('on_hold');
    const resumed = await resumeJob(db, { organizationId, actorUserId: owner.id, jobId: job.id });
    expect(resumed.status).toBe('in_progress');
  });

  it('rejects starting a Job that is not dispatched', async () => {
    const { job } = await createJob(db, {
      organizationId,
      actorUserId: owner.id,
      jobTypeId,
      customerId,
      propertyId,
    });
    await expect(
      startJob(db, { organizationId, actorUserId: owner.id, jobId: job.id }),
    ).rejects.toThrow(InvalidJobStateError);
  });
});
