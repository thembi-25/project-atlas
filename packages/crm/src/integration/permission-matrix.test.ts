import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  archiveCustomer,
  createCustomer,
  ForbiddenError,
  getCustomer,
  updateCustomer,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-2.md: "Unauthorized roles cannot perform
 * restricted customer operations." Exercises the seeded
 * identity.role_permissions matrix end to end (application layer +
 * RLS) for every Role that holds a `customers` Permission — see
 * SPRINT-2-COMPLETION-REPORT.md, "Permissions."
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = {
  id: randomUUID(),
  email: `crm-perm-owner-${suffix}@example.test`,
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
      email: `crm-dispatcher-${suffix}@example.test`,
      fullName: 'Dispatcher',
    },
  },
  {
    role: 'technician',
    user: {
      id: randomUUID(),
      email: `crm-technician-${suffix}@example.test`,
      fullName: 'Technician',
    },
  },
  {
    role: 'accountant',
    user: {
      id: randomUUID(),
      email: `crm-accountant-${suffix}@example.test`,
      fullName: 'Accountant',
    },
  },
  {
    role: 'read_only',
    user: { id: randomUUID(), email: `crm-readonly-${suffix}@example.test`, fullName: 'Read Only' },
  },
];

let organizationId: string;
let sharedCustomerId: string;

const capturedTokens: Record<string, string> = {};
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    capturedTokens[params.invitedEmail] = params.invitationToken;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const org = await createOrganization(db, {
    name: `CRM Permission Org ${suffix}`,
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

  const created = await createCustomer(db, {
    organizationId,
    actorUserId: owner.id,
    type: 'residential',
    displayName: `Shared Customer ${suffix}`,
  });
  sharedCustomerId = created.customer.id;
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
    for (const member of roleMembers) {
      await tx.delete(schema.users).where(eq(schema.users.id, member.user.id));
    }
  });
  await db.$client.end();
});

describe('Role-permission matrix for Customers', () => {
  it('Dispatcher can read and write, but not delete, a Customer', async () => {
    const dispatcher = roleMembers.find((m) => m.role === 'dispatcher')!;
    await expect(
      getCustomer(db, {
        organizationId,
        actorUserId: dispatcher.user.id,
        customerId: sharedCustomerId,
      }),
    ).resolves.toBeDefined();
    await expect(
      updateCustomer(db, {
        organizationId,
        actorUserId: dispatcher.user.id,
        customerId: sharedCustomerId,
        fields: { notes: 'Dispatcher note' },
      }),
    ).resolves.toBeDefined();
    await expect(
      archiveCustomer(db, {
        organizationId,
        actorUserId: dispatcher.user.id,
        customerId: sharedCustomerId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Technician can read but not write a Customer', async () => {
    const technician = roleMembers.find((m) => m.role === 'technician')!;
    await expect(
      getCustomer(db, {
        organizationId,
        actorUserId: technician.user.id,
        customerId: sharedCustomerId,
      }),
    ).resolves.toBeDefined();
    await expect(
      updateCustomer(db, {
        organizationId,
        actorUserId: technician.user.id,
        customerId: sharedCustomerId,
        fields: { notes: 'Technician note' },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("Accountant can read and write (this sprint's role-permission addition), but not delete", async () => {
    const accountant = roleMembers.find((m) => m.role === 'accountant')!;
    await expect(
      getCustomer(db, {
        organizationId,
        actorUserId: accountant.user.id,
        customerId: sharedCustomerId,
      }),
    ).resolves.toBeDefined();
    await expect(
      updateCustomer(db, {
        organizationId,
        actorUserId: accountant.user.id,
        customerId: sharedCustomerId,
        fields: { billingAddressCity: 'Springfield' },
      }),
    ).resolves.toBeDefined();
    await expect(
      archiveCustomer(db, {
        organizationId,
        actorUserId: accountant.user.id,
        customerId: sharedCustomerId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Read Only can read but not write a Customer', async () => {
    const readOnly = roleMembers.find((m) => m.role === 'read_only')!;
    await expect(
      getCustomer(db, {
        organizationId,
        actorUserId: readOnly.user.id,
        customerId: sharedCustomerId,
      }),
    ).resolves.toBeDefined();
    await expect(
      updateCustomer(db, {
        organizationId,
        actorUserId: readOnly.user.id,
        customerId: sharedCustomerId,
        fields: { notes: 'Should not work' },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('Owner (full customers:delete) can archive the Customer', async () => {
    await expect(
      archiveCustomer(db, { organizationId, actorUserId: owner.id, customerId: sharedCustomerId }),
    ).resolves.toBeDefined();
  });
});
