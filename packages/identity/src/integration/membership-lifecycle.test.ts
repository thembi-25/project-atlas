import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withRequestContext, withServiceContext } from '@atlas/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acceptInvitation,
  changeMembershipRole,
  createOrganization,
  inviteMember,
  LastOwnerProtectionError,
  listMembershipsForOrganization,
  reinstateMembership,
  removeMembership,
  suspendMembership,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * Identity PRD §19: "Integration tests for the full invite -> accept ->
 * active lifecycle... unit tests for the last-Owner-protection rule."
 * docs/13-roadmap/sprint-1.md exit criteria: Owners can invite Users with
 * different Roles.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = { id: randomUUID(), email: `owner-${suffix}@example.test`, fullName: 'Sole Owner' };
const secondOwner = {
  id: randomUUID(),
  email: `owner-2-${suffix}@example.test`,
  fullName: 'Second Owner',
};
const invitee = {
  id: randomUUID(),
  email: `technician-${suffix}@example.test`,
  fullName: 'New Technician',
};

let organizationId: string;
let ownerMembershipId: string;

const notifications: { invitedEmail: string; invitationToken: string }[] = [];
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    notifications.push(params);
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const result = await createOrganization(db, {
    name: `Lifecycle Org ${suffix}`,
    tradeTypeIds: [],
    owner,
  });
  organizationId = result.organizationId;
  ownerMembershipId = result.membershipId;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
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
    for (const user of [owner, secondOwner, invitee]) {
      await tx.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
  await db.$client.end();
});

describe('last-owner protection', () => {
  it('blocks removing the sole Owner Membership', async () => {
    await expect(
      removeMembership(db, {
        organizationId,
        actorUserId: owner.id,
        targetMembershipId: ownerMembershipId,
      }),
    ).rejects.toThrow(LastOwnerProtectionError);
  });

  it('blocks demoting the sole Owner via a Role change', async () => {
    await expect(
      changeMembershipRole(db, {
        organizationId,
        actorUserId: owner.id,
        targetMembershipId: ownerMembershipId,
        newRoleName: 'admin',
      }),
    ).rejects.toThrow(LastOwnerProtectionError);
  });

  it('allows removing an Owner once a second active Owner exists', async () => {
    const invite = await inviteMember(
      db,
      {
        organizationId,
        actorUserId: owner.id,
        invitedEmail: secondOwner.email,
        roleName: 'owner',
      },
      capturingNotifier,
    );
    const sent = notifications.find((n) => n.invitedEmail === secondOwner.email);
    expect(sent).toBeDefined();

    await acceptInvitation(db, { token: sent!.invitationToken, invitee: secondOwner });

    await expect(
      removeMembership(db, {
        organizationId,
        actorUserId: owner.id,
        targetMembershipId: ownerMembershipId,
      }),
    ).resolves.not.toThrow();

    const remaining = await withRequestContext(db, secondOwner.id, (tx) =>
      listMembershipsForOrganization(tx, organizationId),
    );
    const original = remaining.find((m) => m.id === ownerMembershipId);
    expect(original?.status).toBe('removed');
    void invite;
  });
});

describe('invite -> accept -> active lifecycle', () => {
  it('takes a Technician invitation through the full documented state machine', async () => {
    const invite = await inviteMember(
      db,
      {
        organizationId,
        actorUserId: secondOwner.id,
        invitedEmail: invitee.email,
        roleName: 'technician',
      },
      capturingNotifier,
    );
    const sent = notifications.find((n) => n.invitedEmail === invitee.email);
    expect(sent).toBeDefined();

    const accepted = await acceptInvitation(db, {
      token: sent!.invitationToken,
      invitee,
    });
    expect(accepted.organizationId).toBe(organizationId);

    await suspendMembership(db, {
      organizationId,
      actorUserId: secondOwner.id,
      targetMembershipId: invite.membershipId,
    });
    await reinstateMembership(db, {
      organizationId,
      actorUserId: secondOwner.id,
      targetMembershipId: invite.membershipId,
    });

    const memberships = await withRequestContext(db, secondOwner.id, (tx) =>
      listMembershipsForOrganization(tx, organizationId),
    );
    const technicianMembership = memberships.find((m) => m.id === invite.membershipId);
    expect(technicianMembership?.status).toBe('active');
  });

  it('rejects a duplicate invitation to the same email while one is pending', async () => {
    const dupeEmail = `dupe-${suffix}@example.test`;
    await inviteMember(
      db,
      {
        organizationId,
        actorUserId: secondOwner.id,
        invitedEmail: dupeEmail,
        roleName: 'read_only',
      },
      capturingNotifier,
    );
    await expect(
      inviteMember(
        db,
        {
          organizationId,
          actorUserId: secondOwner.id,
          invitedEmail: dupeEmail,
          roleName: 'read_only',
        },
        capturingNotifier,
      ),
    ).rejects.toThrow();
  });
});
