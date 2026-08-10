import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { createCustomer } from '@atlas/crm';
import { createProperty } from '@atlas/properties';
import { createJob } from '@atlas/jobs';
import { createInvoice } from '@atlas/financials';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';

/**
 * Real API-layer tests for /api/v1/invoices/{id}/payments —
 * docs/09-testing/api-testing.md, payments.md's idempotent-capture
 * requirement (ADR-018).
 */
const actor = {
  id: randomUUID(),
  email: `payments-api-test-owner-${Date.now()}@example.test`,
  fullName: 'Payments API Test Owner',
};

vi.mock('@/lib/session', () => ({
  getAuthenticatedUser: async () => actor,
}));

let organizationId: string;
let invoiceId: string;

beforeAll(async () => {
  const org = await createOrganization(getDb(), {
    name: `Payments API Test Org ${Date.now()}`,
    tradeTypeIds: [],
    owner: actor,
  });
  organizationId = org.organizationId;

  const customer = await createCustomer(getDb(), {
    organizationId,
    actorUserId: actor.id,
    type: 'residential',
    displayName: 'Payments API Test Customer',
  });

  const property = await createProperty(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyType: 'commercial',
    addressLine1: 'Payments API Test Property',
  });

  const [platformJobType] = await withServiceContext(getDb(), (tx) =>
    tx.select().from(schema.jobTypes).where(isNull(schema.jobTypes.organizationId)).limit(1),
  );
  if (!platformJobType) {
    throw new Error('No platform-default job_types row seeded — see migration 0018.');
  }

  const job = await createJob(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobTypeId: platformJobType.id,
    customerId: customer.customer.id,
    propertyId: property.property.id,
  });

  const invoice = await createInvoice(getDb(), {
    organizationId,
    actorUserId: actor.id,
    jobId: job.job.id,
    lineItems: [{ description: 'API test line', quantity: 1, unitPrice: 100 }],
  });
  invoiceId = invoice.invoice.id;
});

afterAll(async () => {
  await withServiceContext(getDb(), async (tx) => {
    await tx.delete(schema.payments).where(eq(schema.payments.organizationId, organizationId));
    await tx
      .delete(schema.invoiceLineItems)
      .where(eq(schema.invoiceLineItems.organizationId, organizationId));
    await tx.delete(schema.invoices).where(eq(schema.invoices.organizationId, organizationId));
    await tx
      .delete(schema.invoiceNumberCounters)
      .where(eq(schema.invoiceNumberCounters.organizationId, organizationId));
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
    await tx.delete(schema.users).where(eq(schema.users.id, actor.id));
  });
});

describe('POST /api/v1/invoices/{id}/payments', () => {
  it('records a cash Payment as completed and returns 201', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request(`http://localhost/api/v1/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          amount: 40,
          method: 'cash',
          idempotency_key: randomUUID(),
        }),
      }),
      { params: { id: invoiceId } },
    );
    const body = (await response.json()) as { data: { payment: { status: string } } };

    expect(response.status).toBe(201);
    expect(body.data.payment.status).toBe('completed');
  });

  it('returns the same Payment for a repeated idempotency_key rather than double-charging', async () => {
    const idempotencyKey = randomUUID();
    const { POST } = await import('./route');

    const first = await POST(
      new Request(`http://localhost/api/v1/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          amount: 20,
          method: 'check',
          idempotency_key: idempotencyKey,
        }),
      }),
      { params: { id: invoiceId } },
    );
    const firstBody = (await first.json()) as { data: { payment: { id: string } } };

    const second = await POST(
      new Request(`http://localhost/api/v1/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          amount: 20,
          method: 'check',
          idempotency_key: idempotencyKey,
        }),
      }),
      { params: { id: invoiceId } },
    );
    const secondBody = (await second.json()) as { data: { payment: { id: string } } };

    expect(secondBody.data.payment.id).toBe(firstBody.data.payment.id);
  });

  it('rejects a Payment amount exceeding the Invoice balance with 422', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request(`http://localhost/api/v1/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          amount: 999999,
          method: 'cash',
          idempotency_key: randomUUID(),
        }),
      }),
      { params: { id: invoiceId } },
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('validation_error');
  });
});
