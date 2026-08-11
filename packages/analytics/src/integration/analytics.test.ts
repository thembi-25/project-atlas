import { randomUUID } from 'node:crypto';
import { eq, isNull, sql } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ForbiddenError, getRevenueByPeriod, getTechnicianUtilization, refreshAllMaterializedViews } from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * analytics-prd.md §19: "Materialized-view-accuracy tests (compare view
 * output to a direct aggregate query); Role-scoping tests per dashboard."
 * The fixture Payment/Invoice rows are inserted directly (not via
 * `@atlas/financials`'s application layer) since this suite only needs
 * `financials.payments`/`financials.invoices` rows to exist, not to
 * exercise the Estimate→Invoice→Payment lifecycle itself (already
 * covered by `@atlas/financials`'s own integration suite).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = { id: randomUUID(), email: `analytics-owner-${suffix}@example.test`, fullName: 'Owner' };
const dispatcher = { id: randomUUID(), email: `analytics-dispatcher-${suffix}@example.test`, fullName: 'Dispatcher' };
const technician = { id: randomUUID(), email: `analytics-tech-${suffix}@example.test`, fullName: 'Technician' };

let organizationId: string;
let customerId: string;
let jobId: string;
let invoiceId: string;

const capturedTokens: Record<string, string> = {};
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    capturedTokens[params.invitedEmail] = params.invitationToken;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const org = await createOrganization(db, { name: `Analytics Org ${suffix}`, tradeTypeIds: [], owner });
  organizationId = org.organizationId;

  for (const [member, role] of [
    [dispatcher, 'dispatcher'],
    [technician, 'technician'],
  ] as const) {
    await inviteMember(db, { organizationId, actorUserId: owner.id, invitedEmail: member.email, roleName: role }, capturingNotifier);
    const token = capturedTokens[member.email];
    expect(token).toBeDefined();
    await acceptInvitation(db, { token: token!, invitee: member });
  }

  const customer = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Analytics Customer ${suffix}`,
  });
  customerId = customer.customer.id;

  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'residential_single_family',
    addressLine1: `Analytics Property ${suffix}`,
  });

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) throw new Error('No platform-default job_types row seeded.');

  const job = await createJob(db, {
    organizationId,
    actorUserId: owner.id,
    jobTypeId: platformJobType.id,
    customerId,
    propertyId: property.property.id,
  });
  jobId = job.job.id;

  await withServiceContext(db, async (tx) => {
    const [invoice] = await tx
      .insert(schema.invoices)
      .values({ organizationId, customerId, jobId, status: 'finalized', total: '150.00', invoiceNumber: 1 })
      .returning();
    invoiceId = invoice!.id;
    await tx.insert(schema.payments).values({
      organizationId,
      invoiceId,
      amount: '150.00',
      method: 'card',
      status: 'completed',
      idempotencyKey: `analytics-${suffix}`,
      completedAt: new Date(),
    });
  });

  await refreshAllMaterializedViews(db);
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    await tx.delete(schema.payments).where(eq(schema.payments.invoiceId, invoiceId));
    await tx.delete(schema.invoices).where(eq(schema.invoices.id, invoiceId));
  });
});

describe('mv_revenue_by_period accuracy', () => {
  it('reconciles exactly against a direct aggregate over financials.payments', async () => {
    const result = await getRevenueByPeriod(db, { organizationId, actorUserId: owner.id });
    const totalFromView = result.rows.reduce((sum, row) => sum + Number(row.totalRevenue), 0);

    const [directAggregate] = await withServiceContext(db, (tx) =>
      tx.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM financials.payments
        WHERE organization_id = ${organizationId}::uuid AND status = 'completed'
      `),
    );

    expect(totalFromView).toBeCloseTo(Number(directAggregate!.total), 2);
    expect(result.isStale).toBe(false);
    expect(result.asOf).not.toBeNull();
  });
});

describe('Analytics permission scoping', () => {
  it('gives Owner organization-wide scope', async () => {
    const result = await getTechnicianUtilization(db, { organizationId, actorUserId: owner.id });
    expect(result.scope).toBe('organization');
  });

  it('gives Dispatcher team scope', async () => {
    const result = await getTechnicianUtilization(db, { organizationId, actorUserId: dispatcher.id });
    expect(result.scope).toBe('team');
  });

  it('denies Technician access entirely (no reports:* permission)', async () => {
    await expect(getRevenueByPeriod(db, { organizationId, actorUserId: technician.id })).rejects.toThrow(
      ForbiddenError,
    );
  });
});
