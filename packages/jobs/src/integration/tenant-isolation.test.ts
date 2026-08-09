import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { schema, withRequestContext, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createAsset } from '@atlas/assets';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createJob, getJob, listJobs, NotFoundError } from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-4.md security requirements: Organization A
 * cannot select/create/modify Organization B's Jobs, nor reference
 * Organization B's Customer/Property/Asset when creating a Job. This is
 * Sprint 4's Jobs half of the ten mandatory RLS scenarios; see
 * @atlas/scheduling's tenant-isolation suite for the Scheduling/Dispatch
 * half (cross-tenant Technician assignment, appointment access).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = {
  id: randomUUID(),
  email: `jobs-owner-a-${suffix}@example.test`,
  fullName: 'Owner A',
};
const ownerB = {
  id: randomUUID(),
  email: `jobs-owner-b-${suffix}@example.test`,
  fullName: 'Owner B',
};

let organizationAId: string;
let organizationBId: string;
let customerAId: string;
let customerBId: string;
let propertyAId: string;
let propertyBId: string;
let assetBId: string;
let jobTypeId: string;
let jobAId: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `Jobs Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;
  const orgB = await createOrganization(db, {
    name: `Jobs Org B ${suffix}`,
    tradeTypeIds: [],
    owner: ownerB,
  });
  organizationBId = orgB.organizationId;

  const customerA = await createCustomer(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    type: 'residential',
    displayName: `Org A Customer ${suffix}`,
  });
  customerAId = customerA.customer.id;
  const customerB = await createCustomer(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    type: 'residential',
    displayName: `Org B Customer ${suffix}`,
  });
  customerBId = customerB.customer.id;

  const propertyA = await createProperty(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    propertyType: 'commercial',
    addressLine1: `Jobs Test Property A ${suffix}`,
  });
  propertyAId = propertyA.property.id;
  const propertyB = await createProperty(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    propertyType: 'commercial',
    addressLine1: `Jobs Test Property B ${suffix}`,
  });
  propertyBId = propertyB.property.id;

  const [platformAssetType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.assetTypes).where(isNull(schema.assetTypes.organizationId)).limit(1),
  );
  if (!platformAssetType) throw new Error('No platform-default asset_types row seeded.');
  const assetB = await createAsset(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    propertyId: propertyBId,
    assetTypeId: platformAssetType.id,
  });
  assetBId = assetB.id;

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType)
    throw new Error('No platform-default job_types row seeded — see migration 0018.');
  jobTypeId = platformJobType.id;

  const jobA = await createJob(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    jobTypeId,
    customerId: customerAId,
    propertyId: propertyAId,
  });
  jobAId = jobA.job.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const organizationId of [organizationAId, organizationBId]) {
      await tx.delete(schema.tasks).where(eq(schema.tasks.organizationId, organizationId));
      await tx
        .delete(schema.jobStatusHistory)
        .where(eq(schema.jobStatusHistory.organizationId, organizationId));
      await tx.delete(schema.jobAssets).where(eq(schema.jobAssets.organizationId, organizationId));
      await tx
        .delete(schema.jobAssignments)
        .where(eq(schema.jobAssignments.organizationId, organizationId));
      await tx.delete(schema.jobs).where(eq(schema.jobs.organizationId, organizationId));
      await tx
        .delete(schema.jobNumberCounters)
        .where(eq(schema.jobNumberCounters.organizationId, organizationId));

      await tx.delete(schema.assets).where(eq(schema.assets.organizationId, organizationId));
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

describe('Jobs cross-tenant isolation', () => {
  it("Owner B cannot get Org A's Job by ID (masked as not_found)", async () => {
    await expect(
      getJob(db, { organizationId: organizationAId, actorUserId: ownerB.id, jobId: jobAId }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner B sees zero Jobs when listing Org A (no active Membership at all)', async () => {
    await expect(
      listJobs(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        limit: 25,
        sortField: 'created_at',
        sortDirection: 'desc',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot create a Job referencing Org B's Customer", async () => {
    await expect(
      createJob(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        jobTypeId,
        customerId: customerBId,
        propertyId: propertyAId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot create a Job referencing Org B's Property", async () => {
    await expect(
      createJob(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        jobTypeId,
        customerId: customerAId,
        propertyId: propertyBId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot attach Org B's Asset to a Job", async () => {
    await expect(
      createJob(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        jobTypeId,
        customerId: customerAId,
        propertyId: propertyAId,
        assetIds: [assetBId],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Owner A (real member, correct permission) can read their own Job', async () => {
    const job = await getJob(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      jobId: jobAId,
    });
    expect(job.id).toBe(jobAId);
  });

  it('FORCE ROW LEVEL SECURITY holds: a direct select under an unrelated actor context returns zero rows', async () => {
    const rows = await withRequestContext(db, randomUUID(), (tx) =>
      tx.select().from(schema.jobs).where(eq(schema.jobs.organizationId, organizationAId)),
    );
    expect(rows).toHaveLength(0);
  });

  it('produces an audit_events row for Job creation, visible only to Org A', async () => {
    const rows = await withServiceContext(db, (tx) =>
      tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.organizationId, organizationAId),
            eq(schema.auditEvents.entityType, 'jobs.jobs'),
            eq(schema.auditEvents.entityId, jobAId),
          ),
        ),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.organizationId === organizationAId)).toBe(true);
    expect(rows.some((row) => row.action === 'create')).toBe(true);
  });

  it('database FK constraint rejects a Job referencing a non-existent Property, independent of the application layer', async () => {
    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.jobs).values({
          organizationId: organizationAId,
          jobNumber: 999999,
          jobTypeId,
          customerId: customerAId,
          propertyId: randomUUID(),
        }),
      ),
    ).rejects.toThrow();
  });

  it('database unique constraint rejects a duplicate (organization_id, job_number)', async () => {
    const [existing] = await withServiceContext(db, (tx) =>
      tx.select().from(schema.jobs).where(eq(schema.jobs.id, jobAId)).limit(1),
    );
    expect(existing).toBeDefined();

    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.jobs).values({
          organizationId: organizationAId,
          jobNumber: existing!.jobNumber,
          jobTypeId,
          customerId: customerAId,
          propertyId: propertyAId,
        }),
      ),
    ).rejects.toThrow();
  });
});
