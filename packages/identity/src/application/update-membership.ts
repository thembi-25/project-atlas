import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { assertValidMembershipTransition } from '../domain/membership-status';
import {
  LastOwnerProtectionError,
  wouldRemoveLastActiveOwner,
} from '../domain/last-owner-protection';
import { NotFoundError } from '../domain/errors';
import {
  findActiveMembershipByOrgAndUser,
  findMembershipById,
  listOwnerMembershipsForOrganization,
  listRoleNamesForMembership,
  updateMembershipStatus,
  assignRoleToMembership,
} from '../infrastructure/memberships';
import { findRoleByName } from '../infrastructure/roles';
import { schema, type DatabaseClient as Tx } from '@atlas/database';
import { eq } from 'drizzle-orm';

/** Identity PRD §12: "Only Owner/Admin can... change Roles, suspend, or remove Memberships." */
const ROLES_ALLOWED_TO_MANAGE_MEMBERSHIPS = ['owner', 'admin'];

async function requireManagerMembership(
  tx: Tx,
  organizationId: string,
  actorUserId: string,
): Promise<void> {
  const actorMembership = await findActiveMembershipByOrgAndUser(tx, organizationId, actorUserId);
  if (!actorMembership) {
    throw new NotFoundError('Organization');
  }
  const actorRoleNames = await listRoleNamesForMembership(tx, actorMembership.id);
  if (!actorRoleNames.some((name) => ROLES_ALLOWED_TO_MANAGE_MEMBERSHIPS.includes(name))) {
    // 404, not 403 — see docs/05-api/authorization.md.
    throw new NotFoundError('Organization');
  }
}

async function loadTargetMembership(tx: Tx, organizationId: string, membershipId: string) {
  const membership = await findMembershipById(tx, membershipId);
  if (!membership || membership.organizationId !== organizationId) {
    throw new NotFoundError('Membership');
  }
  return membership;
}

async function assertNotLastActiveOwner(
  tx: Tx,
  organizationId: string,
  targetMembershipId: string,
): Promise<void> {
  const ownerMemberships = await listOwnerMembershipsForOrganization(tx, organizationId);
  const summaries = ownerMemberships.map((m) => ({
    membershipId: m.membershipId,
    status: m.status,
    hasOwnerRole: true as const,
  }));
  if (wouldRemoveLastActiveOwner(summaries, targetMembershipId)) {
    throw new LastOwnerProtectionError();
  }
}

export interface MembershipTransitionParams {
  organizationId: string;
  actorUserId: string;
  targetMembershipId: string;
}

export async function suspendMembership(
  db: DatabaseClient,
  params: MembershipTransitionParams,
): Promise<void> {
  await withRequestContext(db, params.actorUserId, async (tx) => {
    await requireManagerMembership(tx, params.organizationId, params.actorUserId);
    const target = await loadTargetMembership(tx, params.organizationId, params.targetMembershipId);
    await assertNotLastActiveOwner(tx, params.organizationId, target.id);
    assertValidMembershipTransition(target.status, 'suspended');
    await updateMembershipStatus(tx, target.id, 'suspended');
  });
}

export async function reinstateMembership(
  db: DatabaseClient,
  params: MembershipTransitionParams,
): Promise<void> {
  await withRequestContext(db, params.actorUserId, async (tx) => {
    await requireManagerMembership(tx, params.organizationId, params.actorUserId);
    const target = await loadTargetMembership(tx, params.organizationId, params.targetMembershipId);
    assertValidMembershipTransition(target.status, 'active');
    await updateMembershipStatus(tx, target.id, 'active');
  });
}

export async function removeMembership(
  db: DatabaseClient,
  params: MembershipTransitionParams,
): Promise<void> {
  await withRequestContext(db, params.actorUserId, async (tx) => {
    await requireManagerMembership(tx, params.organizationId, params.actorUserId);
    const target = await loadTargetMembership(tx, params.organizationId, params.targetMembershipId);
    await assertNotLastActiveOwner(tx, params.organizationId, target.id);
    assertValidMembershipTransition(target.status, 'removed');
    await updateMembershipStatus(tx, target.id, 'removed');
  });
}

export interface ChangeMembershipRoleParams extends MembershipTransitionParams {
  newRoleName: string;
}

/**
 * Replaces every Role currently held by the target Membership with a
 * single new Role. Atlas supports multi-Role Memberships at the schema
 * level (docs/03-domain/roles.md business rule 2), but the documented
 * Sprint 1 API surface (`PATCH /api/v1/memberships/{id}` — Identity PRD
 * §11) exposes only a single "change Role" operation; assigning
 * additional concurrent Roles beyond that is left for a later sprint that
 * actually needs it.
 */
export async function changeMembershipRole(
  db: DatabaseClient,
  params: ChangeMembershipRoleParams,
): Promise<void> {
  await withRequestContext(db, params.actorUserId, async (tx) => {
    await requireManagerMembership(tx, params.organizationId, params.actorUserId);
    const target = await loadTargetMembership(tx, params.organizationId, params.targetMembershipId);
    if (target.status !== 'active') {
      throw new NotFoundError('Membership');
    }

    const newRole = await findRoleByName(tx, params.newRoleName);
    if (!newRole) {
      throw new NotFoundError('Role');
    }

    const currentRoleNames = await listRoleNamesForMembership(tx, target.id);
    const isDemotingFromOwner =
      currentRoleNames.includes('owner') && params.newRoleName !== 'owner';
    if (isDemotingFromOwner) {
      await assertNotLastActiveOwner(tx, params.organizationId, target.id);
    }

    await tx
      .delete(schema.membershipRoles)
      .where(eq(schema.membershipRoles.membershipId, target.id));
    await assignRoleToMembership(tx, target.id, newRole.id);
  });
}
