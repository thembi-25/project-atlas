import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { schema, withRequestContext, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer, createContact, completePortalLogin } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  capturePayment,
  createEstimate,
  createInvoice,
  getEstimateForPortalContact,
  getInvoiceForPortalContact,
  getEstimate,
  getInvoice,
  NotFoundError,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-5.md security requirements — the ten mandatory
 * RLS/tenant-isolation scenarios, adapted for Estimates/Invoices/
 * Payments, plus the Customer Portal's own Contact-scoped cross-tenant
 * isolation (customer-portal-prd.md).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = {
  id: randomUUID(),
  email: `fin-owner-a-${suffix}@example.test`,
  fullName: 'Owner A',
};
const ownerB = {
  id: randomUUID(),
  email: `fin-owner-b-${suffix}@example.test`,
  fullName: 'Owner B',
};
const portalContactUserId = randomUUID();

let organizationAId: string;
let organizationBId: string;
let jobAId: string;
let jobBId: string;
let jobTypeId: string;
let customerAId: string;
let estimateAId: string;
let invoiceAId: string;
let contactAEmail: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `Fin Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;
  const orgB = await createOrganization(db, {
    name: `Fin Org B ${suffix}`,
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
    displayName: `Fin Customer A ${suffix}`,
  });
  customerAId = customerA.customer.id;
  const propertyA = await createProperty(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    propertyType: 'commercial',
    addressLine1: `Fin Property A ${suffix}`,
  });
  const jobA = await createJob(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    jobTypeId,
    customerId: customerAId,
    propertyId: propertyA.property.id,
  });
  jobAId = jobA.job.id;

  contactAEmail = `fin-contact-a-${suffix}@example.test`;
  const contactA = await createContact(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    customerId: customerAId,
    name: `Portal Contact A ${suffix}`,
    email: contactAEmail,
    portalAccessEnabled: true,
  });
  await completePortalLogin(db, {
    portalUserId: portalContactUserId,
    email: contactAEmail,
    fullName: contactA.name,
  });

  const customerB = await createCustomer(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    type: 'residential',
    displayName: `Fin Customer B ${suffix}`,
  });
  const propertyB = await createProperty(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    propertyType: 'commercial',
    addressLine1: `Fin Property B ${suffix}`,
  });
  const jobB = await createJob(db, {
    organizationId: organizationBId,
    actorUserId: ownerB.id,
    jobTypeId,
    customerId: customerB.customer.id,
    propertyId: propertyB.property.id,
  });
  jobBId = jobB.job.id;

  const estimateA = await createEstimate(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    jobId: jobAId,
    lineItems: [{ description: 'Diagnostic', quantity: 1, unitPrice: 100 }],
  });
  estimateAId = estimateA.estimate.id;

  const invoiceA = await createInvoice(db, {
    organizationId: organizationAId,
    actorUserId: ownerA.id,
    jobId: jobAId,
    lineItems: [{ description: 'Ad hoc repair', quantity: 1, unitPrice: 200 }],
  });
  invoiceAId = invoiceA.invoice.id;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const organizationId of [organizationAId, organizationBId]) {
      await tx.delete(schema.payments).where(eq(schema.payments.organizationId, organizationId));
      await tx
        .delete(schema.creditNotes)
        .where(eq(schema.creditNotes.organizationId, organizationId));
      await tx
        .delete(schema.invoiceLineItems)
        .where(eq(schema.invoiceLineItems.organizationId, organizationId));
      await tx.delete(schema.invoices).where(eq(schema.invoices.organizationId, organizationId));
      await tx
        .delete(schema.invoiceNumberCounters)
        .where(eq(schema.invoiceNumberCounters.organizationId, organizationId));
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
    await tx.delete(schema.users).where(eq(schema.users.id, portalContactUserId));
  });
  await db.$client.end();
});

describe('Financials cross-tenant isolation', () => {
  it("Owner B cannot read Org A's Estimate", async () => {
    await expect(
      getEstimate(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        estimateId: estimateAId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot create an Estimate against Org B's Job while acting in Org A", async () => {
    await expect(
      createEstimate(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        jobId: jobBId,
        lineItems: [{ description: 'Cross-tenant attempt', quantity: 1, unitPrice: 50 }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner B cannot read Org A's Invoice", async () => {
    await expect(
      getInvoice(db, {
        organizationId: organizationAId,
        actorUserId: ownerB.id,
        invoiceId: invoiceAId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Owner A cannot capture a Payment against Org B's Invoice while acting in Org A", async () => {
    const invoiceB = await createInvoice(db, {
      organizationId: organizationBId,
      actorUserId: ownerB.id,
      jobId: jobBId,
      lineItems: [{ description: 'Org B work', quantity: 1, unitPrice: 75 }],
    });
    await expect(
      capturePayment(db, {
        organizationId: organizationAId,
        actorUserId: ownerA.id,
        invoiceId: invoiceB.invoice.id,
        amount: 10,
        method: 'cash',
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('FORCE ROW LEVEL SECURITY holds: a direct select under an unrelated actor context returns zero rows', async () => {
    const rows = await withRequestContext(db, randomUUID(), (tx) =>
      tx
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.organizationId, organizationAId)),
    );
    expect(rows).toHaveLength(0);
  });

  it('produces audit_events rows for Estimate and Invoice creation, visible only to Org A', async () => {
    const estimateAuditRows = await withServiceContext(db, (tx) =>
      tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.organizationId, organizationAId),
            eq(schema.auditEvents.entityType, 'financials.estimates'),
          ),
        ),
    );
    expect(estimateAuditRows.length).toBeGreaterThan(0);
    expect(estimateAuditRows.every((row) => row.organizationId === organizationAId)).toBe(true);

    const invoiceAuditRows = await withServiceContext(db, (tx) =>
      tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.organizationId, organizationAId),
            eq(schema.auditEvents.entityType, 'financials.invoices'),
          ),
        ),
    );
    expect(invoiceAuditRows.length).toBeGreaterThan(0);
  });

  it('database FK constraint rejects an Estimate referencing a non-existent Job, independent of the application layer', async () => {
    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.estimates).values({
          organizationId: organizationAId,
          estimateNumber: 999999,
          jobId: randomUUID(),
          customerId: customerAId,
          subtotal: '0',
          taxTotal: '0',
          total: '0',
        }),
      ),
    ).rejects.toThrow();
  });

  it('database CHECK constraint rejects a zero-amount Payment', async () => {
    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.payments).values({
          organizationId: organizationAId,
          invoiceId: invoiceAId,
          amount: '0',
          method: 'cash',
          idempotencyKey: randomUUID(),
        }),
      ),
    ).rejects.toThrow();
  });

  it('database trigger rejects a Payment that would exceed the Invoice balance', async () => {
    await expect(
      withServiceContext(db, (tx) =>
        tx.insert(schema.payments).values({
          organizationId: organizationAId,
          invoiceId: invoiceAId,
          amount: '999999',
          method: 'cash',
          idempotencyKey: randomUUID(),
        }),
      ),
    ).rejects.toThrow();
  });

  it("a Portal Contact linked to Org A cannot read Org B's Estimate or Invoice", async () => {
    const invoiceB = await createInvoice(db, {
      organizationId: organizationBId,
      actorUserId: ownerB.id,
      jobId: jobBId,
      lineItems: [{ description: 'Org B private work', quantity: 1, unitPrice: 60 }],
    });
    const estimateB = await createEstimate(db, {
      organizationId: organizationBId,
      actorUserId: ownerB.id,
      jobId: jobBId,
      lineItems: [{ description: 'Org B private estimate', quantity: 1, unitPrice: 60 }],
    });

    await expect(
      getEstimateForPortalContact(db, {
        portalUserId: portalContactUserId,
        estimateId: estimateB.estimate.id,
      }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      getInvoiceForPortalContact(db, {
        portalUserId: portalContactUserId,
        invoiceId: invoiceB.invoice.id,
      }),
    ).rejects.toThrow(NotFoundError);

    // Sanity check: the same Portal Contact CAN read their own Org's Estimate.
    await expect(
      getEstimateForPortalContact(db, {
        portalUserId: portalContactUserId,
        estimateId: estimateAId,
      }),
    ).resolves.toBeDefined();
  });
});
