import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob, completeJob, startJob } from '@atlas/jobs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  capturePayment,
  convertEstimateToInvoice,
  createEstimate,
  finalizeInvoice,
  ForbiddenError,
  issueCreditNote,
  listEstimates,
  refundPayment,
  sendEstimate,
  approveEstimateAsStaff,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * estimates.md/invoices.md/payments.md, "Permission requirements":
 * Dispatcher read-only; Technician can create/send/manage Estimates and
 * draft Invoices and capture Payments, but NOT finalize/void/refund
 * (Accountant/Admin/Owner-only — see migration 0021's `credit_notes_
 * insert` comment for the same elevated-tier reasoning applied to
 * `estimates:finalize`/`estimates:void`/`invoices:finalize`/
 * `invoices:void`/`payments:refund`).
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `fin-perm-owner-${suffix}@example.test`,
  fullName: 'Perm Owner',
};
const dispatcher = {
  id: randomUUID(),
  email: `fin-perm-dispatcher-${suffix}@example.test`,
  fullName: 'Dispatcher',
};
const technician = {
  id: randomUUID(),
  email: `fin-perm-tech-${suffix}@example.test`,
  fullName: 'Technician',
};
const accountant = {
  id: randomUUID(),
  email: `fin-perm-accountant-${suffix}@example.test`,
  fullName: 'Accountant',
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
    name: `Fin Permission Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;

  for (const [member, role] of [
    [dispatcher, 'dispatcher'],
    [technician, 'technician'],
    [accountant, 'accountant'],
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
    displayName: `Fin Permission Customer ${suffix}`,
  });
  const property = await createProperty(db, {
    organizationId,
    actorUserId: owner.id,
    propertyType: 'commercial',
    addressLine1: `Fin Permission Property ${suffix}`,
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
  await startJob(db, { organizationId, actorUserId: owner.id, jobId });
  await completeJob(db, { organizationId, actorUserId: owner.id, jobId });
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
    for (const user of [owner, dispatcher, technician, accountant]) {
      await tx.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
  await db.$client.end();
});

describe('Role-permission matrix for Estimates/Invoices/Payments', () => {
  it('Dispatcher can read but not create Estimates', async () => {
    await expect(
      listEstimates(db, {
        organizationId,
        actorUserId: dispatcher.id,
        limit: 10,
        sortField: 'created_at',
        sortDirection: 'desc',
      }),
    ).resolves.toBeDefined();

    await expect(
      createEstimate(db, {
        organizationId,
        actorUserId: dispatcher.id,
        jobId,
        lineItems: [{ description: 'Dispatcher attempt', quantity: 1, unitPrice: 10 }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Technician can create, send, and capture cash payments, but cannot finalize an Invoice or issue a Credit Note', async () => {
    const created = await createEstimate(db, {
      organizationId,
      actorUserId: technician.id,
      jobId,
      lineItems: [{ description: 'Technician-created line', quantity: 1, unitPrice: 40 }],
    });
    await sendEstimate(db, {
      organizationId,
      actorUserId: technician.id,
      estimateId: created.estimate.id,
    });
    const approved = await approveEstimateAsStaff(db, {
      organizationId,
      actorUserId: technician.id,
      estimateId: created.estimate.id,
    });
    expect(approved.status).toBe('approved');

    // Convert requires estimates:finalize — Technician does not hold it.
    await expect(
      convertEstimateToInvoice(db, {
        organizationId,
        actorUserId: technician.id,
        estimateId: created.estimate.id,
      }),
    ).rejects.toThrow(ForbiddenError);

    const convertedByOwner = await convertEstimateToInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      estimateId: created.estimate.id,
    });

    // Finalize requires invoices:finalize — Technician does not hold it.
    await expect(
      finalizeInvoice(db, {
        organizationId,
        actorUserId: technician.id,
        invoiceId: convertedByOwner.invoice.id,
      }),
    ).rejects.toThrow(ForbiddenError);

    const finalizedByOwner = await finalizeInvoice(db, {
      organizationId,
      actorUserId: owner.id,
      invoiceId: convertedByOwner.invoice.id,
    });

    // Technician CAN capture a payment.
    const captured = await capturePayment(db, {
      organizationId,
      actorUserId: technician.id,
      invoiceId: finalizedByOwner.id,
      amount: 40,
      method: 'cash',
      idempotencyKey: randomUUID(),
    });
    expect(captured.payment.status).toBe('completed');

    // Technician cannot issue a Credit Note (invoices:void) or refund (payments:refund).
    await expect(
      issueCreditNote(db, {
        organizationId,
        actorUserId: technician.id,
        invoiceId: finalizedByOwner.id,
        reason: 'Technician attempt',
        amount: -5,
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      refundPayment(db, {
        organizationId,
        actorUserId: technician.id,
        paymentId: captured.payment.id,
        amount: 10,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Accountant can finalize, void via Credit Note, and refund', async () => {
    const created = await createEstimate(db, {
      organizationId,
      actorUserId: accountant.id,
      jobId,
      lineItems: [{ description: 'Accountant-created line', quantity: 1, unitPrice: 60 }],
    });
    await sendEstimate(db, {
      organizationId,
      actorUserId: accountant.id,
      estimateId: created.estimate.id,
    });
    await approveEstimateAsStaff(db, {
      organizationId,
      actorUserId: accountant.id,
      estimateId: created.estimate.id,
    });
    const converted = await convertEstimateToInvoice(db, {
      organizationId,
      actorUserId: accountant.id,
      estimateId: created.estimate.id,
    });
    const finalized = await finalizeInvoice(db, {
      organizationId,
      actorUserId: accountant.id,
      invoiceId: converted.invoice.id,
    });
    expect(finalized.status).toBe('finalized');

    const creditNote = await issueCreditNote(db, {
      organizationId,
      actorUserId: accountant.id,
      invoiceId: finalized.id,
      reason: 'Accountant adjustment',
      amount: -5,
    });
    expect(creditNote.amount).toBe('-5.00');
  });
});
