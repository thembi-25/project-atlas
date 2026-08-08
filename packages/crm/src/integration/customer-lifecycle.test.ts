import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { createOrganization } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  archiveContact,
  archiveCustomer,
  createContact,
  createCustomer,
  InvalidCustomerStateError,
  listContacts,
  restoreCustomer,
  searchCustomers,
  updateContact,
  updateCustomer,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * Identity PRD-style coverage for CRM: the full Customer/Contact
 * lifecycle, duplicate detection, and the business rules in
 * docs/03-domain/customers.md / docs/03-domain/contacts.md.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `crm-lifecycle-owner-${suffix}@example.test`,
  fullName: 'Lifecycle Owner',
};

let organizationId: string;

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `CRM Lifecycle Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = org.organizationId;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
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

describe('Customer creation — implicit primary Contact', () => {
  it('auto-creates a primary Contact from name/phone/email when none is given', async () => {
    const result = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Jane Implicit ${suffix}`,
      primaryContact: { phone: '555-0100', email: `jane-${suffix}@example.test` },
    });

    expect(result.primaryContact.name).toBe(`Jane Implicit ${suffix}`);
    expect(result.primaryContact.phone).toBe('555-0100');
    expect(result.primaryContact.isPrimary).toBe(true);

    const contacts = await listContacts(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
    });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.isPrimary).toBe(true);
  });
});

describe('duplicate detection', () => {
  it('flags an exact-phone match against an existing Customer without blocking creation', async () => {
    const phone = `555-${suffix.slice(-4)}`;
    const first = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Original Customer ${suffix}`,
      primaryContact: { phone },
    });

    const second = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Totally Different Name ${suffix}`,
      primaryContact: { phone },
    });

    expect(second.potentialDuplicates.map((c) => c.id)).toContain(first.customer.id);
  });
});

describe('primary Contact uniqueness', () => {
  it('unsets the previous primary Contact when a new one is created as primary', async () => {
    const result = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'commercial',
      displayName: `Acme Corp ${suffix}`,
    });

    const secondContact = await createContact(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
      name: 'Second Contact',
      isPrimary: true,
    });

    const contacts = await listContacts(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
    });
    const primaries = contacts.filter((c) => c.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.id).toBe(secondContact.id);
  });

  it('unsets the previous primary Contact when an existing one is updated to primary', async () => {
    const result = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'commercial',
      displayName: `Beta Corp ${suffix}`,
    });
    const other = await createContact(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
      name: 'Other Contact',
    });

    await updateContact(db, {
      organizationId,
      actorUserId: owner.id,
      contactId: other.id,
      fields: { isPrimary: true },
    });

    const contacts = await listContacts(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
    });
    const primaries = contacts.filter((c) => c.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.id).toBe(other.id);
  });
});

describe('last-Contact protection', () => {
  it("blocks archiving a Customer's only remaining Contact", async () => {
    const result = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Solo Contact Customer ${suffix}`,
    });

    await expect(
      archiveContact(db, {
        organizationId,
        actorUserId: owner.id,
        contactId: result.primaryContact.id,
      }),
    ).rejects.toThrow(InvalidCustomerStateError);
  });

  it('allows archiving a Contact once a second Contact exists', async () => {
    const result = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Two Contact Customer ${suffix}`,
    });
    await createContact(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
      name: 'Second Contact',
    });

    await expect(
      archiveContact(db, {
        organizationId,
        actorUserId: owner.id,
        contactId: result.primaryContact.id,
      }),
    ).resolves.not.toThrow();
  });
});

describe('Customer update and soft-delete', () => {
  it('updates ordinary fields without touching deleted_at', async () => {
    const result = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Update Me ${suffix}`,
    });

    const updated = await updateCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
      fields: { notes: 'Gate code 1234' },
    });

    expect(updated.notes).toBe('Gate code 1234');
    expect(updated.deletedAt).toBeNull();
  });

  it('archives (soft-deletes) and restores a Customer', async () => {
    const result = await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Archive Me ${suffix}`,
    });

    const archived = await archiveCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
    });
    expect(archived.deletedAt).not.toBeNull();

    const restored = await restoreCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      customerId: result.customer.id,
    });
    expect(restored.deletedAt).toBeNull();
  });
});

describe('search', () => {
  it('finds a Customer by a fuzzy/partial name match', async () => {
    await createCustomer(db, {
      organizationId,
      actorUserId: owner.id,
      type: 'residential',
      displayName: `Searchable Wonderland ${suffix}`,
    });

    const hits = await searchCustomers(db, {
      organizationId,
      actorUserId: owner.id,
      query: 'Wonderland',
      limit: 10,
    });

    expect(hits.some((hit) => hit.customer.displayName.includes('Wonderland'))).toBe(true);
  });
});
