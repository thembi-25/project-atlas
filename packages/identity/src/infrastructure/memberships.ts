import { and, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';
import type { MembershipStatus } from '../domain/membership-status';

type Membership = typeof schema.organizationMemberships.$inferSelect;

export async function insertActiveMembership(
  tx: DatabaseClient,
  params: { organizationId: string; userId: string; jobTitle?: string | undefined },
): Promise<Membership> {
  const [membership] = await tx
    .insert(schema.organizationMemberships)
    .values({
      organizationId: params.organizationId,
      userId: params.userId,
      status: 'active',
      jobTitle: params.jobTitle ?? null,
    })
    .returning();
  if (!membership) {
    throw new Error('Failed to insert membership');
  }
  return membership;
}

export async function insertInvitedMembership(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    invitedEmail: string;
    invitedByUserId: string;
    invitationTokenHash: string;
    invitationExpiresAt: Date;
    jobTitle?: string | undefined;
  },
): Promise<Membership> {
  const [membership] = await tx
    .insert(schema.organizationMemberships)
    .values({
      organizationId: params.organizationId,
      status: 'invited',
      invitedEmail: params.invitedEmail,
      invitedByUserId: params.invitedByUserId,
      invitedAt: new Date(),
      invitationTokenHash: params.invitationTokenHash,
      invitationExpiresAt: params.invitationExpiresAt,
      jobTitle: params.jobTitle ?? null,
    })
    .returning();
  if (!membership) {
    throw new Error('Failed to insert invited membership');
  }
  return membership;
}

export async function findMembershipById(
  tx: DatabaseClient,
  membershipId: string,
): Promise<Membership | undefined> {
  const [membership] = await tx
    .select()
    .from(schema.organizationMemberships)
    .where(eq(schema.organizationMemberships.id, membershipId))
    .limit(1);
  return membership;
}

export async function findActiveMembershipByOrgAndUser(
  tx: DatabaseClient,
  organizationId: string,
  userId: string,
): Promise<Membership | undefined> {
  const [membership] = await tx
    .select()
    .from(schema.organizationMemberships)
    .where(
      and(
        eq(schema.organizationMemberships.organizationId, organizationId),
        eq(schema.organizationMemberships.userId, userId),
        eq(schema.organizationMemberships.status, 'active'),
      ),
    )
    .limit(1);
  return membership;
}

export async function findPendingInvitationByOrgAndEmail(
  tx: DatabaseClient,
  organizationId: string,
  invitedEmail: string,
): Promise<Membership | undefined> {
  const [membership] = await tx
    .select()
    .from(schema.organizationMemberships)
    .where(
      and(
        eq(schema.organizationMemberships.organizationId, organizationId),
        eq(schema.organizationMemberships.invitedEmail, invitedEmail),
        eq(schema.organizationMemberships.status, 'invited'),
      ),
    )
    .limit(1);
  return membership;
}

export async function findMembershipByInvitationTokenHash(
  tx: DatabaseClient,
  invitationTokenHash: string,
): Promise<Membership | undefined> {
  const [membership] = await tx
    .select()
    .from(schema.organizationMemberships)
    .where(eq(schema.organizationMemberships.invitationTokenHash, invitationTokenHash))
    .limit(1);
  return membership;
}

export async function listMembershipsForOrganization(
  tx: DatabaseClient,
  organizationId: string,
): Promise<Membership[]> {
  return tx
    .select()
    .from(schema.organizationMemberships)
    .where(eq(schema.organizationMemberships.organizationId, organizationId));
}

export async function updateMembershipStatus(
  tx: DatabaseClient,
  membershipId: string,
  status: MembershipStatus,
): Promise<Membership> {
  const [membership] = await tx
    .update(schema.organizationMemberships)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.organizationMemberships.id, membershipId))
    .returning();
  if (!membership) {
    throw new Error('Failed to update membership status');
  }
  return membership;
}

export async function attachAcceptedUser(
  tx: DatabaseClient,
  membershipId: string,
  userId: string,
): Promise<Membership> {
  const [membership] = await tx
    .update(schema.organizationMemberships)
    .set({
      userId,
      status: 'active',
      invitedEmail: null,
      invitationTokenHash: null,
      invitationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.organizationMemberships.id, membershipId))
    .returning();
  if (!membership) {
    throw new Error('Failed to accept invitation');
  }
  return membership;
}

export async function assignRoleToMembership(
  tx: DatabaseClient,
  membershipId: string,
  roleId: string,
): Promise<void> {
  await tx.insert(schema.membershipRoles).values({ membershipId, roleId });
}

export async function listRoleNamesForMembership(
  tx: DatabaseClient,
  membershipId: string,
): Promise<string[]> {
  const rows = await tx
    .select({ name: schema.roles.name })
    .from(schema.membershipRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.membershipRoles.roleId))
    .where(eq(schema.membershipRoles.membershipId, membershipId));
  return rows.map((row) => row.name);
}

export interface OwnerMembershipRow {
  membershipId: string;
  status: Membership['status'];
}

/** Every Membership in the Organization that currently holds the Owner Role — see domain/last-owner-protection.ts. */
export async function listOwnerMembershipsForOrganization(
  tx: DatabaseClient,
  organizationId: string,
): Promise<OwnerMembershipRow[]> {
  const rows = await tx
    .select({
      membershipId: schema.organizationMemberships.id,
      status: schema.organizationMemberships.status,
    })
    .from(schema.organizationMemberships)
    .innerJoin(
      schema.membershipRoles,
      eq(schema.membershipRoles.membershipId, schema.organizationMemberships.id),
    )
    .innerJoin(schema.roles, eq(schema.roles.id, schema.membershipRoles.roleId))
    .where(
      and(
        eq(schema.organizationMemberships.organizationId, organizationId),
        eq(schema.roles.name, 'owner'),
      ),
    );
  return rows;
}
