import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer, createContact, completePortalLogin } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob, completeJob, startJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approveEstimateAsPortalContact,
  capturePayment,
  convertEstimateToInvoice,
  createEstimate,
  finalizeInvoice,
  getInvoice,
  refundPayment,
  rejectEstimateAsStaff,
  sendEstimate,
  sendInvoice,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * Full Estimate -> Invoice -> Payment flow — estimates.md/invoices.md/
 * payments.md state machines, invoicing-prd.md's "zero re-entry" goal
 * (an approved Estimate's line items are mirrored verbatim onto the
 * Invoice `convertEstimateToInvoice` generates).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `fin-flow-owner-${suffix}@example.test`,
  fullName: 'Flow Owner',
};

let organizationId: string;
let customerId: string;
let propertyId: string;
let jobTypeId: string;
let contactEmail: string;
let portalContactUserId: string;

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

async function makeCompletedJob() {
  const jobId = await makeJob();
  await startJob(db, { organizationId, actorUserId: owner.id, jobId });
  await completeJob(db, { organizationId, actorUserId: owner.id, jobId });
  return jobId;
}

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `Fin Flow Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  const customer = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Fin Flow Customer ${suffix}`,
  });
  customerId = customer.customer.id;
  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Fin Flow Property ${suffix}`,
  });
  propertyId = property.property.id;

  const [platformJobType] = await withServiceContext(db, (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) throw new Error('No platform-default job_types row seeded.');
  jobTypeId = platformJobType.id;

  contactEmail = `fin-flow-contact-${suffix}@example.test`;
  portalContactUserId = randomUUID();
  const contact = await createContact(db, {
    organizationId,
    actorUserId: owner.id,
    customerId,
    name: `Flow Contact ${suffix}`,
    email: contactEmail,
    portalAccessEnabled: true,
  });
  await completePortalLogin(db, {
    portalUserId: portalContactUserId,
    email: contactEmail,
    fullName: contact.name,
  });
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
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
    await tx
      .delete(schema.jobAssignments)
      .where(eq(schema.jobAssignments.organizationId, organizationId));
    await tx.delete(schema.jobs).where(eq(schema.jobs.organizationId, organizationId));
    await tx
      .delete(schema.jobNumberCounters)
      .where(eq(schema.jobNumberCounters.organizationId, organizationId));
    await tx.delete(schema.properties).where(eq(schema.properties.organizationId, organizationId));
    await tx.delete(schema.contacts).where(eq(schema.contacts.customerId, customerId));
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
    await tx.delete(schema.users).where(eq(schema.users.id, portalContactUserId));
  });
  await db.$client.end();
});

describe('Estimate -> Invoice -> Payment lifecycle', () => {
  it('runs draft -> sent -> approved (Portal) -> converted -> finalized -> sent -> paid (cash)', async () => {
    const jobId = await makeCompletedJob();
    const created = await createEstimate(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      lineItems: [
        { description: 'Diagnostic visit', quantity: 1, unitPrice: 89.99 },
        { description: 'Replacement part', quantity: 2, unitPrice: 45 },
      ],
    });
    expect(created.estimate.status).toBe('draft');
    expect(created.estimate.total).toBe('179.99');

    const sent = await sendEstimate(db, {
      organizationId,
      actorUserId: owner.id,
      estimateId: created.estimate.id,
    });
    expect(sent.status).toBe('sent');

    const approved = await approveEstimateAsPortalContact(db, {
      portalUserId: portalContactUserId,
      estimateId: created.estimate.id,
    });
    expect(approved.status).toBe('approved');
    expect(approved.approvedByContactId).not.toBeNull();

    const converted = await convertEstimateToInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      estimateId: created.estimate.id,
    });
    expect(converted.estimate.status).toBe('converted');
    expect(converted.invoice.status).toBe('draft');
    expect(converted.invoice.total).toBe('179.99');

    const finalized = await finalizeInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: converted.invoice.id,
    });
    expect(finalized.status).toBe('finalized');
    expect(finalized.invoiceNumber).not.toBeNull();

    const sentInvoice = await sendInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: finalized.id,
    });
    expect(sentInvoice.status).toBe('sent');

    const captured = await capturePayment(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: finalized.id,
      amount: 179.99,
      method: 'cash',
      idempotencyKey: randomUUID(),
    });
    expect(captured.payment.status).toBe('completed');

    const result = await getInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: finalized.id,
    });
    expect(result.invoice.status).toBe('paid');
    expect(result.balanceDue).toBe(0);
  });

  it('rejects an Estimate and does not allow converting it', async () => {
    const jobId = await makeJob();
    const created = await createEstimate(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      lineItems: [{ description: 'Quote', quantity: 1, unitPrice: 50 }],
    });
    await sendEstimate(db, {
      organizationId,
      actorUserId: owner.id,
      estimateId: created.estimate.id,
    });
    const rejected = await rejectEstimateAsStaff(db, {
      organizationId,
      actorUserId: owner.id,
      estimateId: created.estimate.id,
      reason: 'Customer declined',
    });
    expect(rejected.status).toBe('rejected');
  });

  it('records a partial cash payment, refunds it, and never lets amount_paid go negative in the ledger', async () => {
    const jobId = await makeCompletedJob();
    const created = await createEstimate(db, {
      organizationId,
      actorUserId: owner.id,
      jobId,
      lineItems: [{ description: 'Service call', quantity: 1, unitPrice: 300 }],
    });
    await sendEstimate(db, {
      organizationId,
      actorUserId: owner.id,
      estimateId: created.estimate.id,
    });
    await approveEstimateAsPortalContact(db, {
      portalUserId: portalContactUserId,
      estimateId: created.estimate.id,
    });
    const converted = await convertEstimateToInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      estimateId: created.estimate.id,
    });
    await finalizeInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: converted.invoice.id,
    });
    await sendInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: converted.invoice.id,
    });

    const captured = await capturePayment(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: converted.invoice.id,
      amount: 150,
      method: 'check',
      idempotencyKey: randomUUID(),
    });

    const midway = await getInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: converted.invoice.id,
    });
    expect(midway.invoice.status).toBe('partially_paid');
    expect(midway.balanceDue).toBe(150);

    const refunded = await refundPayment(db, {
      organizationId,
      actorUserId: owner.id,
      paymentId: captured.payment.id,
      amount: 150,
      idempotencyKey: randomUUID(),
    });
    expect(refunded.originalPayment.status).toBe('refunded');
    expect(refunded.refundPayment.amount).toBe('-150.00');

    const afterRefund = await getInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: converted.invoice.id,
    });
    expect(afterRefund.amountPaid).toBe(0);
  });
});
